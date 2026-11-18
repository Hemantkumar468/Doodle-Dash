import { createSlice } from '@reduxjs/toolkit';
import { DEFAULT_DRAWING_COLOR } from '../../lib/drawingPalette';

const initialState = {
  phase: 'LOBBY', round: 0, totalRounds: 0, drawerId: null, blanks: '', word: '',
  wordOptions: [], turnEndsAt: null, strokeHistory: [], roundEnd: null, gameOver: null,
  tool: 'brush', color: DEFAULT_DRAWING_COLOR, size: 7,
};

function applyGame(state, payload = {}) {
  const game = payload.game || payload;
  for (const key of ['phase', 'round', 'totalRounds', 'drawerId', 'blanks', 'word', 'turnEndsAt']) {
    if (game[key] !== undefined) state[key] = game[key];
  }
  if (game.rounds !== undefined) state.totalRounds = game.rounds;
  if (Array.isArray(game.options)) state.wordOptions = game.options;
  if (Array.isArray(game.wordOptions)) state.wordOptions = game.wordOptions;
  if (game.gameOver !== undefined) state.gameOver = game.gameOver;
}

const slice = createSlice({
  name: 'game', initialState,
  reducers: {
    gameStateReceived(state, { payload }) {
      applyGame(state, payload);
      state.strokeHistory = [];
      if (state.phase !== 'ROUND_END') state.roundEnd = null;
      if (state.phase !== 'GAME_OVER') state.gameOver = null;
    },
    roundStarted(state, { payload }) {
      applyGame(state, payload);
      state.phase = 'WORD_SELECTION';
      state.roundEnd = null;
      state.word = '';
      state.blanks = '';
      state.strokeHistory = [];
      state.wordOptions = payload?.options || [];
    },
    wordChosen(state, { payload }) { applyGame(state, payload); state.phase = 'DRAWING'; state.wordOptions = []; },
    roundEnded(state, { payload }) { state.phase = 'ROUND_END'; state.roundEnd = payload; state.word = payload?.word || state.word; },
    gameEnded(state, { payload }) { state.phase = 'GAME_OVER'; state.gameOver = payload; },
    setTool(state, { payload }) { state.tool = payload; },
    setColor(state, { payload }) { state.color = payload; state.tool = 'brush'; },
    setSize(state, { payload }) { state.size = payload; },
    clearOverlays(state) { state.roundEnd = null; state.gameOver = null; },
    resetGame: () => initialState,
  },
});

export const { gameStateReceived, roundStarted, wordChosen, roundEnded, gameEnded, setTool, setColor, setSize, clearOverlays, resetGame } = slice.actions;
export const selectIsDrawer = (state) => state.game.drawerId === state.session.playerId;
export default slice.reducer;
