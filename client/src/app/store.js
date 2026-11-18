import { configureStore } from '@reduxjs/toolkit';
import room from '../features/room/roomSlice';
import game from '../features/game/gameSlice';
import chat from '../features/chat/chatSlice';
import session from '../features/session/sessionSlice';
import { socketMiddleware } from '../middleware/socketMiddleware';
import { historyApi } from '../features/history/historyApi';

export const store = configureStore({
  reducer: { room, game, chat, session, [historyApi.reducerPath]: historyApi.reducer },
  // Intercept socket/emit before RTK's serializability check so optional ack
  // callbacks never enter Redux state or DevTools.
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().prepend(socketMiddleware).concat(historyApi.middleware),
});
