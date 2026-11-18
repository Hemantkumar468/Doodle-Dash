import { describe, expect, it } from 'vitest';
import { Game } from '../src/game/Game.js';
import { Player } from '../src/game/Player.js';

describe('turn order', () => {
  it('gives every player one turn in every round', async () => {
    const players = ['A', 'B', 'C'].map((name) => new Player({ socketId: name, name }));
    const room = {
      settings: { rounds: 2, wordChoices: 1, customWords: '', wordMode: 'Normal', drawTime: 15, hints: 0 },
      players: new Map(players.map((player) => [player.id, player])),
      emitPerPlayer() {}, broadcastState() {}, broadcast() {}, snapshotFor() { return {}; }
    };
    const game = new Game(room, { choices: async () => ['house'] });
    const drawers = [];
    await game.start();
    for (let turn = 0; turn < 6; turn += 1) {
      drawers.push(game.drawerId);
      game.chooseWord(game.drawerId, 'house');
      await game.endTurn();
      game.clearTimers();
      if (turn < 5) await game.nextTurn();
    }
    expect(drawers).toEqual([...players.map((player) => player.id), ...players.map((player) => player.id)]);
  });
});
