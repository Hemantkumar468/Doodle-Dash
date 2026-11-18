import { createSlice } from '@reduxjs/toolkit';
import { readSession } from '../../lib/session';

const stored = typeof window !== 'undefined' ? readSession() : null;
const initialState = { playerId: stored?.playerId || null, roomId: stored?.roomId || null, name: stored?.name || '', avatar: stored?.avatar || '🦊', socketStatus: 'idle', replaced: false };
const slice = createSlice({
  name: 'session', initialState,
  reducers: {
    sessionSet(state, { payload }) { Object.assign(state, payload); state.replaced = false; },
    socketStatusChanged(state, { payload }) { state.socketStatus = payload; },
    sessionReplaced(state) { state.replaced = true; },
    sessionCleared: () => ({ ...initialState, playerId: null, roomId: null, socketStatus: 'idle' }),
  },
});
export const { sessionSet, socketStatusChanged, sessionReplaced, sessionCleared } = slice.actions;
export default slice.reducer;
