import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as createClient } from 'socket.io-client';
import { createRealtimeServer } from '../src/app.js';
import { RoomManager } from '../src/game/RoomManager.js';

const config = {
  NODE_ENV: 'development', CLIENT_URL: 'http://localhost:5173',
  LOBBY_GRACE_MS: 80, GAME_GRACE_MS: 120, DRAWER_GRACE_MS: 100
};
const wordService = { choices: async ({ count }) => ['giraffe', 'bicycle', 'watermelon', 'castle', 'octopus'].slice(0, count) };
const emitAck = (socket, event, payload = {}) => new Promise((resolve) => socket.emit(event, payload, resolve));
const event = (socket, name) => new Promise((resolve) => socket.once(name, resolve));

describe('Socket.IO rooms', () => {
  let resources;
  let url;
  const clients = [];

  beforeEach(async () => {
    const manager = new RoomManager({ wordService });
    resources = createRealtimeServer({ manager, config });
    await new Promise((resolve) => resources.httpServer.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${resources.httpServer.address().port}`;
  });

  afterEach(async () => {
    clients.forEach((client) => client.disconnect());
    clients.length = 0;
    resources.manager.clear();
    await new Promise((resolve) => resources.io.close(resolve));
    if (resources.httpServer.listening) await new Promise((resolve) => resources.httpServer.close(resolve));
  });

  async function connect() {
    const socket = createClient(url, { transports: ['websocket'], forceNew: true });
    clients.push(socket);
    if (!socket.connected) await event(socket, 'connect');
    return socket;
  }

  it('creates one room, lets B and C join it, and never creates a wrong-code room', async () => {
    const [a, b, c] = await Promise.all([connect(), connect(), connect()]);
    const created = await emitAck(a, 'create_room', { hostName: 'A', avatar: '1', settings: {} });
    expect(created.ok).toBe(true);
    expect((await emitAck(b, 'join_room', { roomId: created.roomId, playerName: 'B', avatar: '2' })).ok).toBe(true);
    expect((await emitAck(c, 'join_room', { roomId: created.roomId, playerName: 'C', avatar: '3' })).ok).toBe(true);
    expect(resources.manager.rooms.size).toBe(1);
    const wrong = await emitAck(await connect(), 'join_room', { roomId: 'ZZZZZZ', playerName: 'D', avatar: '4' });
    expect(wrong.error.code).toBe('ROOM_NOT_FOUND');
    expect(wrong.error.message).toBe("We couldn't find this room. Please check the code or ask your friend to send it again.");
    expect(resources.manager.rooms.size).toBe(1);
  });

  it('keeps the selected word private and rejects non-drawer drawing', async () => {
    const a = await connect();
    const b = await connect();
    const created = await emitAck(a, 'create_room', { hostName: 'A', avatar: '1', settings: { drawTime: 15 } });
    await emitAck(b, 'join_room', { roomId: created.roomId, playerName: 'B', avatar: '2' });
    const bRound = event(b, 'round_start');
    const started = await emitAck(a, 'start_game');
    expect(started.ok).toBe(true);
    expect(await bRound).not.toHaveProperty('options');
    const bWord = event(b, 'word_chosen');
    await emitAck(a, 'word_chosen', { word: 'giraffe' });
    expect(await bWord).toEqual(expect.not.objectContaining({ word: expect.anything() }));
    const rejected = await emitAck(b, 'draw_start', { strokeId: 'x', x: 0.2, y: 0.2, tool: 'brush', color: '#000000', size: 4 });
    expect(rejected.error.code).toBe('NOT_DRAWER');
    expect(rejected.error.message).toBe('Only the player who is drawing can use the canvas.');
  });

  it('rejoins the same player during grace with score and stroke history', async () => {
    const a = await connect();
    const b = await connect();
    const created = await emitAck(a, 'create_room', { hostName: 'A', avatar: '1', settings: { drawTime: 15 } });
    const joined = await emitAck(b, 'join_room', { roomId: created.roomId, playerName: 'B', avatar: '2' });
    await emitAck(a, 'start_game');
    await emitAck(a, 'word_chosen', { word: 'giraffe' });
    await emitAck(a, 'draw_start', { roomId: created.roomId, x: 0.1, y: 0.1, tool: 'brush', color: '#000000', size: 5 });
    await emitAck(a, 'draw_end', { roomId: created.roomId, x: 0.9, y: 0.9 });
    const room = resources.manager.find(created.roomId);
    room.players.get(joined.playerId).score = 321;
    b.disconnect();
    const replacement = await connect();
    const rejoined = await emitAck(replacement, 'rejoin_room', { roomId: created.roomId, playerId: joined.playerId });
    expect(rejoined.ok).toBe(true);
    expect(rejoined.playerId).toBe(joined.playerId);
    expect(rejoined.snapshot.players.find((player) => player.id === joined.playerId).score).toBe(321);
    expect(rejoined.snapshot.strokeHistory[0].points).toEqual([{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.9 }]);
  });

  it('replaces a duplicate session', async () => {
    const a = await connect();
    const created = await emitAck(a, 'create_room', { hostName: 'A', avatar: '1', settings: {} });
    const replaced = event(a, 'session_replaced');
    const duplicate = await connect();
    const result = await emitAck(duplicate, 'rejoin_room', { roomId: created.roomId, playerId: created.playerId });
    expect(result.ok).toBe(true);
    expect((await replaced).code).toBe('SESSION_REPLACED');
    expect(resources.manager.find(created.roomId).players.size).toBe(1);
    await new Promise((resolve) => setTimeout(resolve, config.LOBBY_GRACE_MS + 30));
    expect(resources.manager.find(created.roomId).players.size).toBe(1);
    expect(resources.manager.find(created.roomId).players.get(created.playerId).isConnected).toBe(true);
  });

  it('does not end an active turn while taking over a duplicate session', async () => {
    const a = await connect();
    const b = await connect();
    const created = await emitAck(a, 'create_room', { hostName: 'A', avatar: '1', settings: { drawTime: 15 } });
    const joined = await emitAck(b, 'join_room', { roomId: created.roomId, playerName: 'B', avatar: '2' });
    await emitAck(a, 'start_game', { roomId: created.roomId });
    await emitAck(a, 'word_chosen', { roomId: created.roomId, word: 'giraffe' });

    const replaced = event(b, 'session_replaced');
    const duplicate = await connect();
    expect((await emitAck(duplicate, 'rejoin_room', { roomId: created.roomId, playerId: joined.playerId })).ok).toBe(true);
    expect((await replaced).code).toBe('SESSION_REPLACED');
    const room = resources.manager.find(created.roomId);
    expect(room.game.phase).toBe('DRAWING');
    expect(room.players.get(joined.playerId).isConnected).toBe(true);
  });

  it('removes a player who does not return before the grace period', async () => {
    const a = await connect();
    const b = await connect();
    const created = await emitAck(a, 'create_room', { hostName: 'A', avatar: '1', settings: {} });
    const joined = await emitAck(b, 'join_room', { roomId: created.roomId, playerName: 'B', avatar: '2' });
    const left = event(a, 'player_left');
    b.disconnect();
    expect((await left).playerId).toBe(joined.playerId);
    expect(resources.manager.find(created.roomId).players.size).toBe(1);
  });

  it('restores the game-over result when a player rejoins', async () => {
    const a = await connect();
    const b = await connect();
    const created = await emitAck(a, 'create_room', { hostName: 'A', avatar: '1', settings: {} });
    const joined = await emitAck(b, 'join_room', { roomId: created.roomId, playerName: 'B', avatar: '2' });
    const room = resources.manager.find(created.roomId);
    room.players.get(created.playerId).score = 500;
    room.players.get(joined.playerId).score = 300;
    await room.game.endGame();
    b.disconnect();
    const replacement = await connect();
    const rejoined = await emitAck(replacement, 'rejoin_room', { roomId: created.roomId, playerId: joined.playerId });
    expect(rejoined.snapshot.phase).toBe('GAME_OVER');
    expect(rejoined.snapshot.gameOver).toEqual({
      winner: { playerId: created.playerId, name: 'A', score: 500 },
      leaderboard: [
        { rank: 1, playerId: created.playerId, name: 'A', avatar: '1', score: 500 },
        { rank: 2, playerId: joined.playerId, name: 'B', avatar: '2', score: 300 }
      ]
    });
  });

  it('clears a kicked socket session so it can create or join another room', async () => {
    const a = await connect();
    const b = await connect();
    const created = await emitAck(a, 'create_room', { hostName: 'A', avatar: '1', settings: {} });
    const joined = await emitAck(b, 'join_room', { roomId: created.roomId, playerName: 'B', avatar: '2' });
    const kicked = event(b, 'error_message');
    expect((await emitAck(a, 'kick_player', { roomId: created.roomId, playerId: joined.playerId })).ok).toBe(true);
    expect(await kicked).toEqual({ code: 'KICKED', message: 'The host removed you from this room.' });
    const next = await emitAck(b, 'create_room', { hostName: 'B', avatar: '2', settings: {} });
    expect(next.ok).toBe(true);
    expect(next.roomId).not.toBe(created.roomId);
  });

  it('requires two connected players before starting', async () => {
    const a = await connect();
    const b = await connect();
    const created = await emitAck(a, 'create_room', { hostName: 'A', avatar: '1', settings: {} });
    await emitAck(b, 'join_room', { roomId: created.roomId, playerName: 'B', avatar: '2' });
    const disconnected = event(a, 'player_updated');
    b.disconnect();
    expect((await disconnected).isConnected).toBe(false);
    const result = await emitAck(a, 'start_game', { roomId: created.roomId });
    expect(result.error.code).toBe('NOT_ENOUGH_PLAYERS');
    expect(result.error.message).toBe('You need at least 2 players to start. Invite a friend with the code above!');
    expect(resources.manager.find(created.roomId).game.phase).toBe('LOBBY');
  });

  it('reserves room for a numeric suffix when duplicate names are 24 characters', async () => {
    const a = await connect();
    const b = await connect();
    const name = 'abcdefghijklmnopqrstuvwx';
    const created = await emitAck(a, 'create_room', { hostName: name, avatar: '1', settings: {} });
    const joined = await emitAck(b, 'join_room', { roomId: created.roomId, playerName: name, avatar: '2' });
    expect(joined.name).not.toBe(name);
    expect(joined.name).toMatch(/ 2$/);
    expect(joined.name.length).toBeLessThanOrEqual(24);
    expect(new Set([...resources.manager.find(created.roomId).players.values()].map((player) => player.name)).size).toBe(2);
  });

  it('rejects switching identity through rejoin on an already-bound socket', async () => {
    const a = await connect();
    const b = await connect();
    const created = await emitAck(a, 'create_room', { hostName: 'A', avatar: '1', settings: {} });
    const joined = await emitAck(b, 'join_room', { roomId: created.roomId, playerName: 'B', avatar: '2' });
    const rejected = await emitAck(b, 'rejoin_room', { roomId: created.roomId, playerId: created.playerId });
    expect(rejected.error.code).toBe('ALREADY_IN_ROOM');
    const room = resources.manager.find(created.roomId);
    expect(room.players.size).toBe(2);
    expect(room.players.get(joined.playerId).socketId).toBe(b.id);
    const idempotent = await emitAck(b, 'rejoin_room', { roomId: created.roomId, playerId: joined.playerId });
    expect(idempotent.ok).toBe(true);
  });

  it('ends a turn when every still-connected non-drawer has guessed', async () => {
    const a = await connect();
    const b = await connect();
    const c = await connect();
    const created = await emitAck(a, 'create_room', { hostName: 'A', avatar: '1', settings: { drawTime: 15 } });
    await emitAck(b, 'join_room', { roomId: created.roomId, playerName: 'B', avatar: '2' });
    await emitAck(c, 'join_room', { roomId: created.roomId, playerName: 'C', avatar: '3' });
    await emitAck(a, 'start_game', { roomId: created.roomId });
    await emitAck(a, 'word_chosen', { roomId: created.roomId, word: 'giraffe' });
    expect((await emitAck(b, 'guess', { roomId: created.roomId, text: 'giraffe' })).correct).toBe(true);
    const ended = event(a, 'round_end');
    c.disconnect();
    expect((await ended).word).toBe('giraffe');
    expect(resources.manager.find(created.roomId).game.phase).toBe('ROUND_END');
  });

  it('lets a sole remaining host reset game over to the lobby', async () => {
    const a = await connect();
    const b = await connect();
    const c = await connect();
    const created = await emitAck(a, 'create_room', { hostName: 'A', avatar: '1', settings: {} });
    await emitAck(b, 'join_room', { roomId: created.roomId, playerName: 'B', avatar: '2' });
    const room = resources.manager.find(created.roomId);
    await room.game.endGame();
    expect((await emitAck(b, 'leave_room', { roomId: created.roomId })).ok).toBe(true);

    const reset = await emitAck(a, 'start_game', { roomId: created.roomId, playAgain: true });
    expect(reset).toMatchObject({ ok: true, reset: true });
    expect(room.game.phase).toBe('LOBBY');
    expect((await emitAck(c, 'join_room', { roomId: created.roomId, playerName: 'C', avatar: '3' })).ok).toBe(true);
  });

  it('skips a drawer removed while word choices are loading', async () => {
    let releaseFirstChoice;
    let choiceCalls = 0;
    resources.manager.wordService = {
      choices: () => {
        choiceCalls += 1;
        if (choiceCalls === 1) return new Promise((resolve) => { releaseFirstChoice = resolve; });
        return Promise.resolve(['bicycle', 'castle', 'octopus']);
      }
    };
    const a = await connect();
    const b = await connect();
    const c = await connect();
    const created = await emitAck(a, 'create_room', { hostName: 'A', avatar: '1', settings: {} });
    const joinedB = await emitAck(b, 'join_room', { roomId: created.roomId, playerName: 'B', avatar: '2' });
    await emitAck(c, 'join_room', { roomId: created.roomId, playerName: 'C', avatar: '3' });

    const starting = emitAck(a, 'start_game', { roomId: created.roomId });
    while (!releaseFirstChoice) await new Promise((resolve) => setTimeout(resolve, 0));
    expect((await emitAck(a, 'leave_room', { roomId: created.roomId })).ok).toBe(true);
    releaseFirstChoice(['giraffe', 'watermelon', 'castle']);
    expect((await starting).ok).toBe(true);

    const room = resources.manager.find(created.roomId);
    expect(room.game.phase).toBe('WORD_SELECTION');
    expect(room.game.drawerId).toBe(joinedB.playerId);
    expect(room.players.has(room.game.drawerId)).toBe(true);
  });
});
