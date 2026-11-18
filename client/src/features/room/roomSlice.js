import { createSlice, createSelector } from '@reduxjs/toolkit';

const defaults = {
  maxPlayers: 8,
  rounds: 3,
  drawTime: 80,
  wordChoices: 3,
  hints: 2,
  wordMode: 'Normal',
  isPrivate: true,
  customWords: '',
};

const initialState = { roomId: null, players: [], settings: defaults, status: 'idle', error: null, notice: null };

function mergeSnapshot(state, payload = {}) {
  const room = payload.room || payload;
  if (room.roomId || room.id) state.roomId = room.roomId || room.id;
  const players = Array.isArray(payload.players) ? payload.players : room.players;
  const readyIds = new Set(payload.readyPlayerIds || room.readyPlayerIds || []);
  if (Array.isArray(players)) state.players = players.map((player) => ({ ...player, isReady: readyIds.has(player.id) }));
  const settings = payload.settings || room.settings;
  if (settings) state.settings = { ...state.settings, ...settings };
  state.status = 'joined';
  state.error = null;
}

const slice = createSlice({
  name: 'room',
  initialState,
  reducers: {
    hydrateRoom: (state, { payload }) => mergeSnapshot(state, payload),
    roomConnecting(state, { payload }) { state.roomId = payload || state.roomId; state.status = 'connecting'; state.error = null; },
    playerUpserted(state, { payload }) {
      const player = payload?.player || payload;
      if (!player?.id) return;
      const index = state.players.findIndex((item) => item.id === player.id);
      if (index < 0) state.players.push(player); else state.players[index] = { ...state.players[index], ...player };
    },
    playerRemoved(state, { payload }) {
      const id = payload?.playerId || payload?.id || payload;
      state.players = state.players.filter((player) => player.id !== id);
    },
    settingsUpdated(state, { payload }) { state.settings = { ...state.settings, ...(payload?.settings || payload) }; },
    roomFailed(state, { payload }) { state.status = 'error'; state.error = payload; },
    roomNotice(state, { payload }) { state.notice = payload; },
    noticeCleared(state) { state.notice = null; },
    resetRoom: () => initialState,
  },
});

export const { hydrateRoom, roomConnecting, playerUpserted, playerRemoved, settingsUpdated, roomFailed, roomNotice, noticeCleared, resetRoom } = slice.actions;
export const selectPlayers = (state) => state.room.players;
export const selectSortedPlayers = createSelector([selectPlayers], (players) => [...players].sort((a, b) => b.score - a.score));
export const selectIsHost = (state) => Boolean(state.room.players.find((p) => p.id === state.session.playerId)?.isHost);
export default slice.reducer;
