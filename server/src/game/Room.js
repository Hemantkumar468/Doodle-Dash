import { Player } from './Player.js';
import { Game, PHASES } from './Game.js';
import { DEFAULT_SETTINGS, normalizeSettings } from './settings.js';

export class Room {
  constructor({ roomId, io, manager, wordService, historyWriter, settings = {}, grace = {} }) {
    this.roomId = roomId;
    this.io = io;
    this.manager = manager;
    this.settings = normalizeSettings(settings, DEFAULT_SETTINGS);
    this.players = new Map();
    this.messages = [];
    this.createdAt = Date.now();
    this.grace = { lobby: 10_000, game: 30_000, drawer: 15_000, ...grace };
    this.game = new Game(this, wordService, { historyWriter });
  }

  get host() { return [...this.players.values()].find((player) => player.isHost) || null; }
  get isPrivate() { return this.settings.isPrivate; }

  uniqueName(requested) {
    const base = String(requested || 'Player').trim().slice(0, 24) || 'Player';
    const names = new Set([...this.players.values()].map((player) => player.name.toLocaleLowerCase('en')));
    if (!names.has(base.toLocaleLowerCase('en'))) return base;
    let suffix = 2;
    let candidate;
    do {
      const ending = ` ${suffix}`;
      candidate = `${base.slice(0, Math.max(1, 24 - ending.length)).trimEnd()}${ending}`;
      suffix += 1;
    } while (names.has(candidate.toLocaleLowerCase('en')));
    return candidate;
  }

  addPlayer({ socketId, deviceId, name, avatar, isHost = false }) {
    if (this.players.size >= this.settings.maxPlayers) return null;
    const player = new Player({ socketId, deviceId, name: this.uniqueName(name), avatar, isHost: isHost || this.players.size === 0 });
    this.players.set(player.id, player);
    return player;
  }

  removePlayer(playerId, reason = 'LEFT') {
    const player = this.players.get(playerId);
    if (!player) return false;
    player.clearRemovalTimer();
    this.players.delete(playerId);
    this.io.sockets.sockets.get(player.socketId)?.leave(this.roomId);
    if (player.isHost && this.players.size) this.reassignHost();
    this.broadcast('player_left', { playerId, name: player.name, reason });
    this.game.onPlayerRemoved(playerId);
    if (!this.players.size) this.manager.delete(this.roomId);
    else this.broadcastState();
    return true;
  }

  reassignHost() {
    for (const player of this.players.values()) player.isHost = false;
    const next = [...this.players.values()].find((player) => player.isConnected) || this.players.values().next().value;
    if (next) next.isHost = true;
    return next;
  }

  playerBySocket(socketId) {
    return [...this.players.values()].find((player) => player.socketId === socketId) || null;
  }

  bindSocket(player, socket) {
    player.clearRemovalTimer();
    const oldSocket = player.socketId && player.socketId !== socket.id ? this.io.sockets.sockets.get(player.socketId) : null;
    player.socketId = socket.id;
    player.isConnected = true;
    socket.join(this.roomId);
    if (oldSocket) {
      oldSocket.emit('session_replaced', { code: 'SESSION_REPLACED', message: 'This player was opened in another tab.' });
      oldSocket.leave(this.roomId);
      oldSocket.disconnect(true);
    }
    // Defensive for adapters that dispatch the old disconnect asynchronously.
    player.clearRemovalTimer();
  }

  markDisconnected(playerId) {
    const player = this.players.get(playerId);
    if (!player || !player.isConnected) return;
    player.isConnected = false;
    this.game.onPlayerDisconnected(playerId);
    this.broadcast('player_updated', player.publicState());
    this.broadcastState();
    const isActive = ![PHASES.LOBBY, PHASES.GAME_OVER].includes(this.game.phase);
    const graceMs = !isActive ? this.grace.lobby : this.game.drawerId === playerId ? this.grace.drawer : this.grace.game;
    player.clearRemovalTimer();
    player.removalTimer = setTimeout(() => this.removePlayer(playerId, 'DISCONNECTED'), graceMs);
    player.removalTimer.unref?.();
  }

  updateSettings(patch) {
    if (this.game.phase !== PHASES.LOBBY) return false;
    this.settings = normalizeSettings(patch, this.settings);
    this.broadcastState();
    return true;
  }

  snapshotFor(playerId) {
    const visibleMessages = this.messages.filter((message) => !message.audience || message.audience.includes(playerId)).slice(-100)
      .map(({ audience, ...message }) => message);
    return {
      room: { id: this.roomId, roomId: this.roomId, isPrivate: this.isPrivate },
      players: [...this.players.values()].map((player) => player.publicState()),
      readyPlayerIds: [...this.players.values()].filter((player) => player.isReady).map((player) => player.id),
      settings: { ...this.settings },
      ...this.game.stateFor(playerId),
      scores: [...this.players.values()].map((player) => ({ playerId: player.id, score: player.score })),
      messages: visibleMessages
    };
  }

  toPublicState() {
    return {
      roomId: this.roomId,
      hostName: this.host?.name || '',
      playerCount: this.players.size,
      maxPlayers: this.settings.maxPlayers,
      rounds: this.settings.rounds,
      drawTime: this.settings.drawTime,
      phase: this.game.phase
    };
  }

  broadcast(event, payload) { this.io.to(this.roomId).emit(event, payload); }

  emitPerPlayer(event, payloadFactory) {
    for (const player of this.players.values()) {
      if (player.socketId && player.isConnected) this.io.to(player.socketId).emit(event, payloadFactory(player));
    }
  }

  broadcastState() { this.emitPerPlayer('game_state', (player) => this.snapshotFor(player.id)); }

  addMessage(message) {
    this.messages.push(message);
    if (this.messages.length > 100) this.messages.splice(0, this.messages.length - 100);
    if (message.audience) {
      for (const playerId of message.audience) {
        const player = this.players.get(playerId);
        if (player?.socketId && player.isConnected) {
          const { audience, ...safeMessage } = message;
          this.io.to(player.socketId).emit('chat_message', safeMessage);
        }
      }
    } else {
      const { audience, ...safeMessage } = message;
      this.broadcast('chat_message', safeMessage);
    }
  }

  destroy() {
    this.game.clearTimers();
    for (const player of this.players.values()) player.clearRemovalTimer();
    this.players.clear();
  }
}
