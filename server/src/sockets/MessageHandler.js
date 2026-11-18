import { ZodError } from 'zod';
import { schemas } from './schemas.js';
import { registerRoomHandlers } from './roomHandlers.js';
import { registerGameHandlers } from './gameHandlers.js';
import { registerDrawHandlers } from './drawHandlers.js';
import { registerChatHandlers } from './chatHandlers.js';

export const FRIENDLY_SOCKET_MESSAGES = Object.freeze({
  ALREADY_IN_ROOM: "You're already in a room. Leave it before joining another one.",
  ROOM_NOT_FOUND: "We couldn't find this room. Please check the code or ask your friend to send it again.",
  ROOM_FULL: 'This room is full. Try another room or create your own.',
  GAME_ALREADY_STARTED: 'This game has already started. You can join the next one.',
  PLAYER_NOT_FOUND: "We couldn't find your place in this room. Please join again.",
  KICKED: 'The host removed you from this room.',
  NOT_HOST: 'Only the host can do this.',
  NOT_ENOUGH_PLAYERS: 'You need at least 2 players to start. Invite a friend with the code above!',
  NOT_DRAWER: 'Only the player who is drawing can use the canvas.',
  INVALID_WORD: 'Please choose one of the words shown.',
  RATE_LIMITED: "You're typing very fast. Please wait a moment.",
  CANNOT_GUESS: "You can't guess right now. Please wait for the next turn.",
  INVALID_PAYLOAD: 'Something went wrong on our side. Please try again.',
  INTERNAL_ERROR: 'Something went wrong on our side. Please try again.',
});

const SAFE_FALLBACK = 'Something went wrong on our side. Please try again.';

export const socketError = (code) => ({ code, message: FRIENDLY_SOCKET_MESSAGES[code] || SAFE_FALLBACK });

export function emitError(socket, code, technicalMessage, ack) {
  const error = socketError(code);
  if (process.env.NODE_ENV === 'development' && technicalMessage && technicalMessage !== error.message) {
    console.warn(`[socket ${code}] ${technicalMessage}`);
  }
  socket.emit('error_message', error);
  if (typeof ack === 'function') ack({ ok: false, error });
  return error;
}

export class MessageHandler {
  constructor(io, manager) {
    this.io = io;
    this.manager = manager;
  }

  register(socket, event, handler) {
    const schema = schemas[event];
    socket.on(event, async (rawPayload, rawAck) => {
      const payload = typeof rawPayload === 'function' ? {} : (rawPayload ?? {});
      const ack = typeof rawPayload === 'function' ? rawPayload : rawAck;
      try {
        const parsed = schema ? schema.parse(payload) : payload;
        await handler(parsed, ack);
      } catch (error) {
        if (error instanceof ZodError) {
          emitError(socket, 'INVALID_PAYLOAD', error.issues[0]?.message || 'Invalid payload.', ack);
        } else {
          if (process.env.NODE_ENV === 'development') console.error(`Socket event ${event} failed:`, error?.message || error);
          emitError(socket, 'INTERNAL_ERROR', 'The server could not process that request.', ack);
        }
      }
    });
  }

  attach(socket) {
    const register = (event, handler) => this.register(socket, event, handler);
    registerRoomHandlers({ io: this.io, socket, manager: this.manager, register });
    registerGameHandlers({ socket, manager: this.manager, register });
    registerDrawHandlers({ socket, manager: this.manager, register });
    registerChatHandlers({ io: this.io, socket, manager: this.manager, register });
    socket.on('disconnect', () => {
      const room = this.manager.find(socket.data.roomId);
      const player = room?.players.get(socket.data.playerId);
      if (player && player.socketId === socket.id) room.markDisconnected(player.id);
    });
  }
}
