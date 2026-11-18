import { randomUUID } from 'node:crypto';
import { emitError } from './MessageHandler.js';
import { context, rateLimit } from './helpers.js';

const ok = (ack, payload = {}) => { if (typeof ack === 'function') ack({ ok: true, ...payload }); };
const cleanText = (value) => String(value || '').replace(/[<>\u0000-\u001F\u007F]/g, '').trim().slice(0, 100);

export function registerChatHandlers({ socket, manager, register }) {
  register('guess', ({ text }, ack) => {
    const result = context(socket, manager, ack);
    if (!result) return;
    if (!rateLimit(socket, 'messages')) return emitError(socket, 'RATE_LIMITED', 'You are sending messages too quickly.', ack);
    const safe = cleanText(text);
    const guess = result.room.game.handleGuess(result.player.id, safe);
    if (!guess.accepted) return emitError(socket, 'CANNOT_GUESS', 'You cannot guess right now.', ack);
    if (guess.exact) {
      const message = {
        id: randomUUID(), type: 'system', playerId: result.player.id, name: result.player.name,
        text: `${result.player.name} guessed the word!`, createdAt: Date.now()
      };
      result.room.addMessage(message);
      return ok(ack, { correct: true, delta: guess.delta });
    }
    if (guess.close) {
      socket.emit('guess_result', { playerId: result.player.id, correct: false, close: true, message: 'Close!' });
      return ok(ack, { correct: false, close: true });
    }
    const message = {
      id: randomUUID(), type: 'guess', playerId: result.player.id, name: result.player.name,
      avatar: result.player.avatar, text: safe, createdAt: Date.now()
    };
    result.room.addMessage(message);
    ok(ack, { correct: false });
  });

  register('chat', ({ text }, ack) => {
    const result = context(socket, manager, ack);
    if (!result) return;
    if (!rateLimit(socket, 'messages')) return emitError(socket, 'RATE_LIMITED', 'You are sending messages too quickly.', ack);
    const safe = cleanText(text);
    const message = {
      id: randomUUID(), type: 'chat', playerId: result.player.id, name: result.player.name,
      avatar: result.player.avatar, text: safe, createdAt: Date.now()
    };
    if (result.player.hasGuessed) {
      message.audience = [...result.room.players.values()]
        .filter((player) => player.hasGuessed || player.id === result.room.game.drawerId)
        .map((player) => player.id);
    }
    result.room.addMessage(message);
    ok(ack);
  });
}
