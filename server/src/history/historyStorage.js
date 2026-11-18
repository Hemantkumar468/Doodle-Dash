import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { GameHistory } from '../models/GameHistory.js';

export const MAX_POINTS_PER_TURN = 2_000;
export const MAX_POINTS_PER_GAME = 100_000;
const MIN_POINT_DISTANCE_SQUARED = 0.000025;

const cleanText = (value, maximum) => String(value || '')
  .replace(/[<>\u0000-\u001F\u007F]/g, '')
  .trim()
  .slice(0, maximum);

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const coordinate = (value) => Math.round(Math.min(1, Math.max(0, finite(value))) * 1_000) / 1_000;

export function compactStrokes(strokes, maxPoints = MAX_POINTS_PER_TURN) {
  const output = [];
  let remaining = Math.max(0, Math.floor(maxPoints));
  for (const source of Array.isArray(strokes) ? strokes : []) {
    if (!remaining) break;
    const points = [];
    let previous = null;
    for (const raw of Array.isArray(source?.points) ? source.points : []) {
      if (!remaining) break;
      const x = coordinate(Array.isArray(raw) ? raw[0] : raw?.x);
      const y = coordinate(Array.isArray(raw) ? raw[1] : raw?.y);
      if (previous && ((x - previous[0]) ** 2 + (y - previous[1]) ** 2) < MIN_POINT_DISTANCE_SQUARED) continue;
      const point = [x, y];
      points.push(point);
      previous = point;
      remaining -= 1;
    }
    if (!points.length) continue;
    output.push({
      color: /^#[0-9a-f]{6}$/i.test(source?.color || '') ? source.color.toLowerCase() : '#111827',
      size: Math.min(80, Math.max(1, finite(source?.size, 7))),
      tool: source?.tool === 'eraser' ? 'eraser' : 'brush',
      points
    });
  }
  return output;
}

export function buildHistoryRecord({ roomId, startedAt, endedAt = new Date(), settings = {}, players = [], turns = [], endedEarly = false }, { storeStrokes = env.HISTORY_STORE_STROKES } = {}) {
  const historyPlayers = (Array.isArray(players) ? players : []).map((player) => {
    const deviceId = cleanText(player?.deviceId, 128);
    return {
      ...(deviceId ? { deviceId } : {}),
      name: cleanText(player?.name, 24) || 'Player',
      avatar: cleanText(player?.avatar, 80),
      finalScore: Math.max(0, Math.floor(finite(player?.finalScore ?? player?.score))),
      rank: Math.max(1, Math.floor(finite(player?.rank, 1)))
    };
  });
  if (!historyPlayers.some((player) => player.deviceId) || !turns.length) return null;
  let remainingGamePoints = MAX_POINTS_PER_GAME;
  const safeTurns = turns.map((turn) => {
    const maxTurnPoints = Math.min(MAX_POINTS_PER_TURN, remainingGamePoints);
    const strokes = storeStrokes ? compactStrokes(turn.strokes, maxTurnPoints) : [];
    remainingGamePoints -= strokes.reduce((total, stroke) => total + stroke.points.length, 0);
    return {
      round: Math.max(1, Math.floor(finite(turn.round, 1))),
      turnIndex: Math.max(0, Math.floor(finite(turn.turnIndex))),
      drawerName: cleanText(turn.drawerName, 24),
      word: cleanText(turn.word, 81),
      guessers: (Array.isArray(turn.guessers) ? turn.guessers : []).slice(0, 20).map((guesser) => ({
        name: cleanText(guesser.name, 24),
        points: Math.max(0, Math.floor(finite(guesser.points))),
        guessedAtSec: Math.max(0, Math.floor(finite(guesser.guessedAtSec)))
      })),
      drawerPoints: Math.max(0, Math.floor(finite(turn.drawerPoints))),
      strokes
    };
  });
  const start = new Date(startedAt || endedAt);
  const end = new Date(endedAt);
  return {
    _id: new mongoose.Types.ObjectId(),
    roomId: cleanText(roomId, 6).toUpperCase(),
    startedAt: start,
    endedAt: end,
    durationSec: Math.max(0, Math.round((end.getTime() - start.getTime()) / 1_000)),
    endedEarly: Boolean(endedEarly),
    settings: {
      rounds: Math.max(1, Math.floor(finite(settings.rounds, 1))),
      drawTime: Math.max(1, Math.floor(finite(settings.drawTime, 80))),
      wordMode: cleanText(settings.wordMode || 'Normal', 20),
      wordCount: Math.max(1, Math.floor(finite(settings.wordCount ?? settings.wordChoices, 3))),
      hints: Math.max(0, Math.floor(finite(settings.hints, 0)))
    },
    players: historyPlayers,
    winnerName: cleanText(historyPlayers.slice().sort((left, right) => left.rank - right.rank)[0]?.name, 24),
    turns: safeTurns
  };
}

export function saveHistoryRecord(record) {
  return GameHistory.create(record);
}

export function logHistoryWriteFailure(error) {
  console.error('[history] Could not save the completed game:', error?.message || 'Unknown database error');
}
