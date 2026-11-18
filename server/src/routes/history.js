import { Router } from 'express';
import mongoose from 'mongoose';
import { z, ZodError } from 'zod';
import { GameHistory } from '../models/GameHistory.js';
import { deviceIdSchema } from '../sockets/schemas.js';

const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().trim().max(256).optional()
});
const gameIdSchema = z.string().trim().refine((value) => mongoose.isValidObjectId(value));

const encodeCursor = (record) => Buffer.from(JSON.stringify([new Date(record.endedAt).toISOString(), String(record._id)])).toString('base64url');
const decodeCursor = (value) => {
  if (!value) return null;
  try {
    const [endedAt, id] = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (!endedAt || !mongoose.isValidObjectId(id) || Number.isNaN(new Date(endedAt).getTime())) throw new Error();
    return { endedAt: new Date(endedAt), id: new mongoose.Types.ObjectId(id) };
  } catch {
    throw new Error('Invalid cursor');
  }
};

const requestDeviceId = (request) => deviceIdSchema.parse(request.get('X-Device-Id') || request.query.deviceId || '');

const summaryFor = (record, deviceId) => {
  const me = record.players.find((player) => player.deviceId === deviceId);
  return {
    id: String(record._id),
    roomId: record.roomId,
    startedAt: record.startedAt,
    endedAt: record.endedAt,
    durationSec: record.durationSec,
    endedEarly: Boolean(record.endedEarly),
    playerCount: record.players.length,
    myRank: me?.rank || null,
    myScore: me?.finalScore || 0,
    winnerName: record.winnerName || ''
  };
};

const detailsFor = (record) => ({
  id: String(record._id),
  roomId: record.roomId,
  startedAt: record.startedAt,
  endedAt: record.endedAt,
  durationSec: record.durationSec,
  endedEarly: Boolean(record.endedEarly),
  settings: record.settings,
  players: record.players.map(({ deviceId: _deviceId, ...player }) => player),
  winnerName: record.winnerName || '',
  turns: record.turns || []
});

function createRateLimiter({ limit = 120, windowMs = 60_000 } = {}) {
  const buckets = new Map();
  return (request, response, next) => {
    const key = request.ip || request.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    const values = (buckets.get(key) || []).filter((timestamp) => now - timestamp < windowMs);
    if (values.length >= limit) return response.status(429).json({ code: 'RATE_LIMITED', message: 'Please wait a moment and try again.' });
    values.push(now);
    buckets.set(key, values);
    if (buckets.size > 1_000) {
      for (const [bucketKey, timestamps] of buckets) {
        if (!timestamps.some((timestamp) => now - timestamp < windowMs)) buckets.delete(bucketKey);
      }
    }
    return next();
  };
}

const invalid = (response) => response.status(400).json({ code: 'INVALID_REQUEST', message: 'Please check the request and try again.' });
const notFound = (response) => response.status(404).json({ code: 'HISTORY_NOT_FOUND', message: "We couldn't find this game. It may have been deleted." });

export function historyRouter(model = GameHistory) {
  const router = Router();
  router.use((_request, response, next) => {
    response.set('Cache-Control', 'private, no-store');
    response.vary('X-Device-Id');
    next();
  });
  router.use(createRateLimiter());

  router.get('/', async (request, response, next) => {
    try {
      const deviceId = requestDeviceId(request);
      const { limit, cursor: rawCursor } = listSchema.parse(request.query);
      const cursor = decodeCursor(rawCursor);
      const filter = { 'players.deviceId': deviceId };
      if (cursor) {
        filter.$or = [
          { endedAt: { $lt: cursor.endedAt } },
          { endedAt: cursor.endedAt, _id: { $lt: cursor.id } }
        ];
      }
      const records = await model.find(filter).sort({ endedAt: -1, _id: -1 }).limit(limit + 1).lean();
      const hasMore = records.length > limit;
      const page = records.slice(0, limit);
      response.json({
        games: page.map((record) => summaryFor(record, deviceId)),
        nextCursor: hasMore && page.length ? encodeCursor(page.at(-1)) : null
      });
    } catch (error) {
      if (error instanceof ZodError || error?.message === 'Invalid cursor') return invalid(response);
      return next(error);
    }
  });

  router.get('/:gameId', async (request, response, next) => {
    try {
      const deviceId = requestDeviceId(request);
      const gameId = gameIdSchema.parse(request.params.gameId);
      const record = await model.findOne({ _id: gameId, 'players.deviceId': deviceId }).lean();
      if (!record) return notFound(response);
      return response.json({ game: detailsFor(record) });
    } catch (error) {
      if (error instanceof ZodError) return invalid(response);
      return next(error);
    }
  });

  router.delete('/:gameId', async (request, response, next) => {
    try {
      const deviceId = requestDeviceId(request);
      const gameId = gameIdSchema.parse(request.params.gameId);
      const record = await model.findOneAndUpdate(
        { _id: gameId, 'players.deviceId': deviceId },
        { $unset: { 'players.$[player].deviceId': '' } },
        { new: true, arrayFilters: [{ 'player.deviceId': deviceId }] }
      ).lean();
      if (!record) return notFound(response);
      if (!record.players.some((player) => player.deviceId)) {
        await model.deleteOne({ _id: gameId, 'players.deviceId': { $exists: false } });
      }
      return response.json({ ok: true });
    } catch (error) {
      if (error instanceof ZodError) return invalid(response);
      return next(error);
    }
  });

  router.delete('/', async (request, response, next) => {
    try {
      const deviceId = requestDeviceId(request);
      const records = await model.find({ 'players.deviceId': deviceId }).select({ _id: 1 }).lean();
      await model.updateMany(
        { 'players.deviceId': deviceId },
        { $unset: { 'players.$[player].deviceId': '' } },
        { arrayFilters: [{ 'player.deviceId': deviceId }] }
      );
      if (records.length) {
        await model.deleteMany({
          _id: { $in: records.map((record) => record._id) },
          'players.deviceId': { $exists: false }
        });
      }
      return response.json({ ok: true, removed: records.length });
    } catch (error) {
      if (error instanceof ZodError) return invalid(response);
      return next(error);
    }
  });

  return router;
}

export { detailsFor, summaryFor };
