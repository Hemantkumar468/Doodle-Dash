import { emitError } from './MessageHandler.js';
import { context, requireHost } from './helpers.js';
import { PHASES } from '../game/Game.js';

const ok = (ack, payload = {}) => typeof ack === 'function' && ack({ ok: true, ...payload });

export function registerGameHandlers({ socket, manager, register }) {
  register('start_game', async (_payload, ack) => {
    const result = requireHost(socket, manager, ack);
    if (!result) return;
    if (result.room.game.phase === PHASES.GAME_OVER) {
      result.room.game.reset();
      ok(ack, { reset: true });
      return;
    }
    const connectedPlayers = [...result.room.players.values()].filter((player) => player.isConnected).length;
    if (connectedPlayers < 2) return emitError(socket, 'NOT_ENOUGH_PLAYERS', 'At least two connected players are required.', ack);
    if (result.room.game.phase !== PHASES.LOBBY) return emitError(socket, 'GAME_ALREADY_STARTED', 'The game is already running.', ack);
    const started = await result.room.game.start();
    if (!started) return emitError(socket, 'NOT_ENOUGH_PLAYERS', 'At least two connected players are required.', ack);
    ok(ack);
  });

  register('word_chosen', ({ word }, ack) => {
    const result = context(socket, manager, ack);
    if (!result) return;
    if (result.player.id !== result.room.game.drawerId) return emitError(socket, 'NOT_DRAWER', 'Only the drawer can choose a word.', ack);
    if (!result.room.game.chooseWord(result.player.id, word)) return emitError(socket, 'INVALID_WORD', 'Choose one of the offered words.', ack);
    ok(ack);
  });
}
