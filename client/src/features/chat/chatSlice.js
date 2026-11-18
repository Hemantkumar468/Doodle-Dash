import { createSlice } from '@reduxjs/toolkit';

const initialState = { messages: [], notice: null, unread: 0, activeTab: 'chat' };
const slice = createSlice({
  name: 'chat', initialState,
  reducers: {
    historyReceived(state, { payload }) { state.messages = (payload || []).slice(-200); },
    messageReceived(state, { payload }) {
      state.messages.push(payload);
      if (state.messages.length > 200) state.messages.shift();
      if (state.activeTab !== 'chat') state.unread += 1;
    },
    guessNotice(state, { payload }) { state.notice = payload; },
    noticeCleared(state) { state.notice = null; },
    setActiveTab(state, { payload }) { state.activeTab = payload; if (payload === 'chat') state.unread = 0; },
    resetChat: () => initialState,
  },
});
export const { historyReceived, messageReceived, guessNotice, noticeCleared, setActiveTab, resetChat } = slice.actions;
export default slice.reducer;
