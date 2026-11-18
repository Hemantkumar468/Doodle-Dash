import express from 'express';
import { createServer } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { env } from '../src/config/env.js';
import { Game } from '../src/game/Game.js';
import { Player } from '../src/game/Player.js';
import { buildHistoryRecord, compactStrokes, MAX_POINTS_PER_TURN } from '../src/history/historyStorage.js';
import { gameHistorySchema } from '../src/models/GameHistory.js';
import { historyRouter } from '../src/routes/history.js';

const deviceA = '11111111-1111-4111-8111-111111111111';
const deviceB = '22222222-2222-4222-8222-222222222222';
const microtasks = async () => { await Promise.resolve(); await Promise.resolve(); };

function gameFixture(historyWriter) {
  const first = new Player({ id: 'a', socketId: 'a', deviceId: deviceA, name: 'Alice', avatar: 'cat', isHost: true });
  const second = new Player({ id: 'b', socketId: 'b', deviceId: deviceB, name: 'Bob', avatar: 'dog' });
  const room = {
    roomId: 'ABC234',
    settings: { rounds: 2, drawTime: 80, wordMode: 'Normal', wordChoices: 3, hints: 2, customWords: '' },
    players: new Map([[first.id, first], [second.id, second]]),
    emitPerPlayer: vi.fn(), broadcast: vi.fn(), broadcastState: vi.fn()
  };
  const game = new Game(room, { choices: async () => ['apple', 'house', 'tiger'] }, { historyWriter, roundPauseMs: 60_000 });
  room.game = game;
  return { game, first, second };
}

function query(value) {
  return { sort() { return this; }, limit() { return this; }, select() { return this; }, lean: async () => value };
}

async function listen(router) {
  const app = express();
  app.use('/api/history', router);
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((resolve) => server.close(resolve)) };
}

describe('game history', () => {
  const servers = [];

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(servers.splice(0).map((server) => server.close()));
  });

  it('creates one complete record and never lets a failed write break game over', async () => {
    const writer = vi.fn().mockResolvedValue(undefined);
    const { game, first, second } = gameFixture(writer);
    await game.start();
    expect(game.chooseWord(first.id, 'apple')).toBe(true);
    game.addStroke({ strokeId: 'one', tool: 'brush', color: '#123456', size: 5, x: 0.12349, y: 0.98765 });
    game.moveStroke({ strokeId: 'one', x: 0.8, y: 0.2 });
    expect(game.handleGuess(second.id, 'apple').exact).toBe(true);
    const payload = await game.endGame();
    await game.endGame();
    await microtasks();

    expect(payload.historyId).toMatch(/^[a-f0-9]{24}$/);
    expect(writer).toHaveBeenCalledTimes(1);
    const record = writer.mock.calls[0][0];
    expect(record.players.map(({ name, rank }) => ({ name, rank }))).toEqual([
      { name: 'Bob', rank: 1 }, { name: 'Alice', rank: 2 }
    ]);
    expect(record.turns).toHaveLength(1);
    expect(record.turns[0]).toMatchObject({ round: 1, turnIndex: 0, drawerName: 'Alice', word: 'apple' });
    expect(record.turns[0].guessers[0]).toMatchObject({ name: 'Bob', points: expect.any(Number) });
    expect(record.turns[0].strokes[0].points).toEqual([[0.123, 0.988], [0.8, 0.2]]);

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failing = gameFixture(vi.fn().mockRejectedValue(new Error('database unavailable')));
    await failing.game.start();
    failing.game.chooseWord(failing.first.id, 'apple');
    failing.game.handleGuess(failing.second.id, 'apple');
    await expect(failing.game.endGame()).resolves.toHaveProperty('leaderboard');
    await microtasks();
    expect(consoleError).toHaveBeenCalledWith('[history] Could not save the completed game:', 'database unavailable');
  });

  it('normalizes stroke coordinates, removes near duplicates and caps stored points', () => {
    const rawPoints = Array.from({ length: MAX_POINTS_PER_TURN + 50 }, (_, index) => ({ x: index / 100, y: index / 100 }));
    rawPoints.splice(1, 0, { x: 0.0001, y: 0.0001 });
    const result = compactStrokes([{ color: '#ABCDEF', size: 200, tool: 'brush', points: rawPoints }]);
    const points = result.flatMap((stroke) => stroke.points);
    expect(points.length).toBeLessThanOrEqual(MAX_POINTS_PER_TURN);
    expect(result[0]).toMatchObject({ color: '#abcdef', size: 80, tool: 'brush' });
    expect(points[0]).toEqual([0, 0]);
    expect(points[1]).not.toEqual([0, 0]);
    expect(points.every(([x, y]) => x >= 0 && x <= 1 && y >= 0 && y <= 1)).toBe(true);
  });

  it('marks a too-few-player finish early and keeps the player who left', async () => {
    const writer = vi.fn().mockResolvedValue(undefined);
    const { game, first, second } = gameFixture(writer);
    await game.start();
    game.chooseWord(first.id, 'apple');
    game.handleGuess(second.id, 'apple');
    game.room.players.delete(second.id);
    game.onPlayerRemoved(second.id);
    await microtasks();
    const record = writer.mock.calls[0][0];
    expect(record.endedEarly).toBe(true);
    expect(record.players.map((player) => player.name)).toContain('Bob');
  });

  it('keeps the drawer identity when the drawer leaves during a turn', async () => {
    const writer = vi.fn().mockResolvedValue(undefined);
    const { game, first } = gameFixture(writer);
    await game.start();
    game.chooseWord(first.id, 'apple');
    game.room.players.delete(first.id);
    game.onPlayerRemoved(first.id);
    await microtasks();

    const record = writer.mock.calls[0][0];
    expect(record.endedEarly).toBe(true);
    expect(record.turns[0]).toMatchObject({ drawerName: 'Alice', drawerPoints: 0, word: 'apple' });
  });

  it('ignores a stale word lookup after an early finish and starts the next game cleanly', async () => {
    let resolveStaleChoices;
    const wordService = {
      choices: vi.fn()
        .mockImplementationOnce(() => new Promise((resolve) => { resolveStaleChoices = resolve; }))
        .mockResolvedValueOnce(['banana', 'house', 'tiger'])
    };
    const writer = vi.fn().mockResolvedValue(undefined);
    const first = new Player({ id: 'a', socketId: 'a', deviceId: deviceA, name: 'Alice', avatar: 'cat', isHost: true });
    const second = new Player({ id: 'b', socketId: 'b', deviceId: deviceB, name: 'Bob', avatar: 'dog' });
    const room = {
      roomId: 'ABC234',
      settings: { rounds: 2, drawTime: 80, wordMode: 'Normal', wordChoices: 3, hints: 2, customWords: '' },
      players: new Map([[first.id, first], [second.id, second]]),
      emitPerPlayer: vi.fn(), broadcast: vi.fn(), broadcastState: vi.fn()
    };
    const game = new Game(room, wordService, { historyWriter: writer, roundPauseMs: 60_000 });
    room.game = game;

    const staleStart = game.start();
    await microtasks();
    expect(game.phase).toBe('WORD_SELECTION');

    room.players.delete(second.id);
    game.onPlayerRemoved(second.id);
    expect(game.phase).toBe('GAME_OVER');
    game.reset();
    const replacement = new Player({ id: 'c', socketId: 'c', deviceId: '33333333-3333-4333-8333-333333333333', name: 'Cara', avatar: 'fox' });
    room.players.set(replacement.id, replacement);

    await expect(game.start()).resolves.toBe(true);
    expect(game.phase).toBe('WORD_SELECTION');
    expect(game.drawerId).toBe(first.id);
    expect(game.wordOptions).toEqual(['banana', 'house', 'tiger']);
    expect(game.transitioning).toBe(false);

    resolveStaleChoices(['stale', 'words', 'only']);
    await expect(staleStart).resolves.toBe(false);
    expect(game.phase).toBe('WORD_SELECTION');
    expect(game.drawerId).toBe(first.id);
    expect(game.wordOptions).toEqual(['banana', 'house', 'tiger']);
    expect(game.transitioning).toBe(false);
    expect(room.emitPerPlayer).toHaveBeenCalledTimes(1);
  });

  it('can omit drawings and declares device/date and TTL indexes', () => {
    const record = buildHistoryRecord({
      roomId: 'ABC234', startedAt: new Date(0), endedAt: new Date(1_000),
      settings: { rounds: 2, drawTime: 80, wordMode: 'Normal', wordChoices: 3, hints: 2 },
      players: [{ deviceId: deviceA, name: 'Alice', rank: 1, finalScore: 100 }],
      turns: [{ round: 1, turnIndex: 0, drawerName: 'Alice', word: 'apple', strokes: [{ points: [{ x: 0, y: 0 }] }] }]
    }, { storeStrokes: false });
    expect(record.turns[0].strokes).toEqual([]);
    const indexes = gameHistorySchema.indexes();
    expect(indexes).toEqual(expect.arrayContaining([
      [{ 'players.deviceId': 1, endedAt: -1 }, expect.any(Object)],
      [{ createdAt: 1 }, expect.objectContaining({ expireAfterSeconds: env.HISTORY_RETENTION_DAYS * 86_400 })]
    ]));
  });

  it('keeps the full leaderboard when a participant has no history access id', () => {
    const record = buildHistoryRecord({
      roomId: 'ABC234', startedAt: new Date(0), endedAt: new Date(1_000),
      settings: { rounds: 2, drawTime: 80, wordMode: 'Normal', wordChoices: 3, hints: 2 },
      players: [
        { name: 'Legacy winner', rank: 1, finalScore: 500 },
        { deviceId: deviceA, name: 'Alice', rank: 2, finalScore: 200 }
      ],
      turns: [{ round: 1, turnIndex: 0, drawerName: 'Legacy winner', word: 'apple' }]
    });

    expect(record.winnerName).toBe('Legacy winner');
    expect(record.players).toEqual([
      { name: 'Legacy winner', avatar: '', finalScore: 500, rank: 1 },
      { deviceId: deviceA, name: 'Alice', avatar: '', finalScore: 200, rank: 2 }
    ]);
    expect(buildHistoryRecord({
      roomId: 'ABC234', startedAt: new Date(0), endedAt: new Date(1_000),
      players: [{ name: 'No access', rank: 1, finalScore: 100 }],
      turns: [{ round: 1, turnIndex: 0, drawerName: 'No access', word: 'apple' }]
    })).toBeNull();
  });

  it('scopes list/detail access and deletes the document after its last device leaves', async () => {
    const record = {
      _id: '64b000000000000000000001', roomId: 'ABC234', startedAt: new Date(0), endedAt: new Date(1_000), durationSec: 1,
      players: [
        { deviceId: deviceA, name: 'Alice', avatar: 'cat', finalScore: 100, rank: 1 },
        { deviceId: deviceB, name: 'Bob', avatar: 'dog', finalScore: 50, rank: 2 }
      ],
      winnerName: 'Alice', turns: [{ round: 1, turnIndex: 0, drawerName: 'Alice', word: 'apple', guessers: [], strokes: [] }], settings: {}
    };
    let stored = structuredClone(record);
    const model = {
      find: vi.fn((filter) => query(stored && stored.players.some((player) => player.deviceId === filter['players.deviceId']) ? [structuredClone(stored)] : [])),
      findOne: vi.fn((filter) => query(stored && stored._id === filter._id && stored.players.some((player) => player.deviceId === filter['players.deviceId']) ? structuredClone(stored) : null)),
      findOneAndUpdate: vi.fn((filter) => {
        if (!stored || stored._id !== filter._id || !stored.players.some((player) => player.deviceId === filter['players.deviceId'])) return query(null);
        stored.players.forEach((player) => {
          if (player.deviceId === filter['players.deviceId']) delete player.deviceId;
        });
        return query(structuredClone(stored));
      }),
      deleteOne: vi.fn(async () => { stored = null; }), updateMany: vi.fn(async () => {}), deleteMany: vi.fn(async () => {})
    };
    const server = await listen(historyRouter(model));
    servers.push(server);

    const listResponse = await fetch(`${server.url}/api/history`, { headers: { 'X-Device-Id': deviceA } });
    expect(listResponse.headers.get('cache-control')).toBe('private, no-store');
    expect(listResponse.headers.get('vary')).toContain('X-Device-Id');
    const list = await listResponse.json();
    expect(list.games).toHaveLength(1);
    expect(list.games[0]).toMatchObject({ myRank: 1, myScore: 100, playerCount: 2 });
    expect(JSON.stringify(list)).not.toContain(deviceA);
    expect(JSON.stringify(list)).not.toContain('strokes');

    const denied = await fetch(`${server.url}/api/history/${record._id}`, { headers: { 'X-Device-Id': '33333333-3333-4333-8333-333333333333' } });
    expect(denied.status).toBe(404);
    const details = await fetch(`${server.url}/api/history/${record._id}`, { headers: { 'X-Device-Id': deviceA } }).then((response) => response.json());
    expect(details.game.players).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'Alice' })]));
    expect(JSON.stringify(details)).not.toContain(deviceA);

    expect((await fetch(`${server.url}/api/history/${record._id}`, { method: 'DELETE', headers: { 'X-Device-Id': deviceA } })).status).toBe(200);
    expect(stored.players).toHaveLength(2);
    expect(stored.players.find((player) => player.name === 'Alice')).not.toHaveProperty('deviceId');
    expect((await fetch(`${server.url}/api/history/${record._id}`, { headers: { 'X-Device-Id': deviceA } })).status).toBe(404);
    const remainingDetails = await fetch(`${server.url}/api/history/${record._id}`, { headers: { 'X-Device-Id': deviceB } }).then((response) => response.json());
    expect(remainingDetails.game.players.map((player) => player.name)).toEqual(['Alice', 'Bob']);
    expect(JSON.stringify(remainingDetails)).not.toContain('deviceId');
    expect(JSON.stringify(remainingDetails)).not.toContain(deviceB);
    expect((await fetch(`${server.url}/api/history/${record._id}`, { method: 'DELETE', headers: { 'X-Device-Id': deviceB } })).status).toBe(200);
    expect(stored).toBeNull();
    expect(model.deleteOne).toHaveBeenCalledTimes(1);
  });

  it('clears only one device access and preserves shared game leaderboards', async () => {
    const sharedId = '64b000000000000000000002';
    const privateId = '64b000000000000000000003';
    let stored = [
      {
        _id: sharedId, roomId: 'SHARED', startedAt: new Date(0), endedAt: new Date(2_000), durationSec: 2,
        players: [
          { deviceId: deviceA, name: 'Alice', avatar: 'cat', finalScore: 100, rank: 1 },
          { deviceId: deviceB, name: 'Bob', avatar: 'dog', finalScore: 50, rank: 2 }
        ],
        winnerName: 'Alice', turns: [], settings: {}
      },
      {
        _id: privateId, roomId: 'ALONE1', startedAt: new Date(0), endedAt: new Date(1_000), durationSec: 1,
        players: [{ deviceId: deviceA, name: 'Alice', avatar: 'cat', finalScore: 100, rank: 1 }],
        winnerName: 'Alice', turns: [], settings: {}
      }
    ];
    const hasAccess = (record, deviceId) => record.players.some((player) => player.deviceId === deviceId);
    const model = {
      find: vi.fn((filter) => query(stored.filter((record) => hasAccess(record, filter['players.deviceId'])).map((record) => structuredClone(record)))),
      findOne: vi.fn((filter) => query(structuredClone(stored.find((record) => record._id === filter._id && hasAccess(record, filter['players.deviceId'])) || null))),
      updateMany: vi.fn(async (filter) => {
        stored.forEach((record) => {
          if (!hasAccess(record, filter['players.deviceId'])) return;
          record.players.forEach((player) => {
            if (player.deviceId === filter['players.deviceId']) delete player.deviceId;
          });
        });
      }),
      deleteMany: vi.fn(async (filter) => {
        stored = stored.filter((record) => !filter._id.$in.includes(record._id) || record.players.some((player) => player.deviceId));
      })
    };
    const server = await listen(historyRouter(model));
    servers.push(server);

    const clearResponse = await fetch(`${server.url}/api/history`, { method: 'DELETE', headers: { 'X-Device-Id': deviceA } });
    expect(clearResponse.status).toBe(200);
    await expect(clearResponse.json()).resolves.toEqual({ ok: true, removed: 2 });
    expect(stored).toHaveLength(1);
    expect(stored[0].players).toHaveLength(2);
    expect(stored[0].players.find((player) => player.name === 'Alice')).not.toHaveProperty('deviceId');
    expect((await fetch(`${server.url}/api/history/${sharedId}`, { headers: { 'X-Device-Id': deviceA } })).status).toBe(404);

    const remainingDetails = await fetch(`${server.url}/api/history/${sharedId}`, { headers: { 'X-Device-Id': deviceB } }).then((response) => response.json());
    expect(remainingDetails.game.players.map((player) => player.name)).toEqual(['Alice', 'Bob']);
    expect(JSON.stringify(remainingDetails)).not.toContain('deviceId');
    expect(JSON.stringify(remainingDetails)).not.toContain(deviceB);
    expect(model.updateMany).toHaveBeenCalledWith(
      { 'players.deviceId': deviceA },
      { $unset: { 'players.$[player].deviceId': '' } },
      { arrayFilters: [{ 'player.deviceId': deviceA }] }
    );
  });
});
