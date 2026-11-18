import { emitError } from './MessageHandler.js';

export function context(socket, manager, ack) {
  const room = manager.find(socket.data.roomId);
  const player = room?.players.get(socket.data.playerId);
  if (!room || !player || player.socketId !== socket.id) {
    emitError(socket, 'PLAYER_NOT_FOUND', 'Your player session was not found.', ack);
    return null;
  }
  return { room, player };
}

export function requireHost(socket, manager, ack) {
  const result = context(socket, manager, ack);
  if (!result) return null;
  if (!result.player.isHost) {
    emitError(socket, 'NOT_HOST', 'Only the room host can do that.', ack);
    return null;
  }
  return result;
}

export function requireDrawer(socket, manager, ack) {
  const result = context(socket, manager, ack);
  if (!result) return null;
  if (result.room.game.drawerId !== result.player.id || result.room.game.phase !== 'DRAWING') {
    emitError(socket, 'NOT_DRAWER', 'Only the current drawer can draw.', ack);
    return null;
  }
  return result;
}

export function rateLimit(socket, bucket, { limit = 5, windowMs = 3000 } = {}) {
  socket.data.rateLimits ||= new Map();
  const now = Date.now();
  const timestamps = (socket.data.rateLimits.get(bucket) || []).filter((time) => now - time < windowMs);
  if (timestamps.length >= limit) return false;
  timestamps.push(now);
  socket.data.rateLimits.set(bucket, timestamps);
  return true;
}
