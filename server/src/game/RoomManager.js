import { randomInt } from 'node:crypto';
import { Room } from './Room.js';
import { WordService } from './WordService.js';
import { saveHistoryRecord } from '../history/historyStorage.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export class RoomManager {
  constructor({ io = null, wordService = new WordService(), historyWriter = saveHistoryRecord, grace = {} } = {}) {
    this.rooms = new Map();
    this.io = io;
    this.wordService = wordService;
    this.historyWriter = historyWriter;
    this.grace = grace;
  }

  configure({ io, wordService, historyWriter, grace } = {}) {
    if (io) this.io = io;
    if (wordService) this.wordService = wordService;
    if (historyWriter) this.historyWriter = historyWriter;
    if (grace) this.grace = grace;
    return this;
  }

  generateId() {
    let roomId;
    do {
      roomId = Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
    } while (this.rooms.has(roomId));
    return roomId;
  }

  create(settings = {}) {
    if (!this.io) throw new Error('RoomManager requires Socket.IO before creating rooms');
    const roomId = this.generateId();
    const room = new Room({ roomId, io: this.io, manager: this, wordService: this.wordService, historyWriter: this.historyWriter, settings, grace: this.grace });
    this.rooms.set(roomId, room);
    return room;
  }

  find(roomId) { return this.rooms.get(String(roomId || '').trim().toUpperCase()) || null; }

  delete(roomId) {
    const room = this.find(roomId);
    if (!room) return false;
    room.destroy();
    this.rooms.delete(room.roomId);
    return true;
  }

  listPublic() {
    return [...this.rooms.values()]
      .filter((room) => !room.isPrivate && room.game.phase === 'LOBBY' && room.players.size < room.settings.maxPlayers)
      .map((room) => room.toPublicState());
  }

  clear() {
    for (const room of [...this.rooms.values()]) this.delete(room.roomId);
  }
}

export const roomManager = new RoomManager();
