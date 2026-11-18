import { socket } from '../lib/socket';
import { hydrateRoom, playerUpserted, playerRemoved, settingsUpdated, roomFailed, roomNotice } from '../features/room/roomSlice';
import { gameStateReceived, roundStarted, wordChosen, roundEnded, gameEnded } from '../features/game/gameSlice';
import { historyReceived, messageReceived, guessNotice, noticeCleared as chatNoticeCleared } from '../features/chat/chatSlice';
import { sessionReplaced, socketStatusChanged } from '../features/session/sessionSlice';
import { clearSession } from '../lib/session';
import { replaceCanvasHistory, splitCanvasSnapshot } from '../lib/canvasHistory';
import { getFriendlyError, messages } from '../lib/messages';

let installed = false;
let pendingHostChange = false;

function install(store) {
  if (installed) return;
  installed = true;
  const { dispatch, getState } = store;
  socket.on('connect', () => dispatch(socketStatusChanged('connected')));
  socket.on('disconnect', () => dispatch(socketStatusChanged('disconnected')));
  socket.on('connect_error', () => dispatch(socketStatusChanged('error')));
  socket.on('room_state', (data) => {
    const { snapshot, strokeHistory } = splitCanvasSnapshot(data);
    if (strokeHistory !== null) replaceCanvasHistory(strokeHistory);
    dispatch(hydrateRoom(snapshot));
  });
  socket.on('player_joined', (data) => dispatch(playerUpserted(data)));
  socket.on('player_updated', (data) => {
    const player = data?.player || data;
    const previous = getState().room.players.find((item) => item.id === player?.id);
    dispatch(playerUpserted(data));
    if (previous && !previous.isConnected && player?.isConnected) {
      dispatch(roomNotice({ message: messages.chat.playerBack(player.name || messages.common.player), tone: 'info' }));
    }
  });
  socket.on('player_left', (data) => {
    const previousState = getState();
    const player = previousState.room.players.find((item) => item.id === (data?.playerId || data?.id));
    pendingHostChange = Boolean(player?.isHost);
    dispatch(playerRemoved(data));
    if (player?.id === previousState.game.drawerId) {
      dispatch(roomNotice({ message: messages.chat.drawerLeft, tone: 'info' }));
    } else if (!pendingHostChange) {
      dispatch(roomNotice({ message: messages.chat.playerLeft(data?.name || player?.name || messages.common.player), tone: 'info' }));
    }
  });
  socket.on('settings_updated', (data) => dispatch(settingsUpdated(data)));
  socket.on('game_state', (data) => {
    const { snapshot, strokeHistory } = splitCanvasSnapshot(data);
    if (strokeHistory !== null) replaceCanvasHistory(strokeHistory);
    dispatch(gameStateReceived(snapshot));
    if (snapshot?.room || snapshot?.players || snapshot?.settings) dispatch(hydrateRoom(snapshot));
    if (snapshot?.messages || snapshot?.chat) dispatch(historyReceived(snapshot.messages || snapshot.chat));
    if (pendingHostChange) {
      const players = snapshot?.players || snapshot?.room?.players || [];
      const host = players.find((player) => player.isHost);
      if (host?.name) dispatch(roomNotice({ message: messages.room.hostChanged(host.name), tone: 'info' }));
      pendingHostChange = false;
    }
  });
  socket.on('round_start', (data) => { replaceCanvasHistory([]); dispatch(roundStarted(data)); dispatch(chatNoticeCleared()); });
  socket.on('word_chosen', (data) => dispatch(wordChosen(data)));
  socket.on('round_end', (data) => dispatch(roundEnded(data)));
  socket.on('game_over', (data) => dispatch(gameEnded(data)));
  socket.on('chat_message', (data) => dispatch(messageReceived(data)));
  socket.on('guess_result', (data = {}) => {
    const message = data.close
      ? messages.chat.closeGuess
      : data.correct
        ? messages.chat.correctOther(data.name || messages.common.player)
        : getFriendlyError(data);
    dispatch(guessNotice({ ...data, message }));
  });
  socket.on('session_replaced', () => { clearSession(); dispatch(sessionReplaced()); });
  socket.on('error_message', (data) => {
    if (import.meta.env.DEV) console.debug('[game details]', data?.code, data?.message, JSON.stringify(data));
    const friendly = { code: data?.code || '', message: getFriendlyError(data) };
    if (['ROOM_NOT_FOUND', 'PLAYER_NOT_FOUND', 'KICKED', 'ROOM_CLOSED'].includes(data?.code)) dispatch(roomFailed(friendly));
    else if (['RATE_LIMITED', 'CANNOT_GUESS'].includes(data?.code)) dispatch(guessNotice(friendly));
    else dispatch(roomNotice(friendly));
  });
}

export const socketMiddleware = (store) => {
  install(store);
  return (next) => (action) => {
    if (action.type === 'socket/emit') {
      const { event, payload, ack } = action.payload;
      socket.emit(event, payload, ack);
      return action;
    }
    return next(action);
  };
};

export const emitSocket = (event, payload, ack) => ({ type: 'socket/emit', payload: { event, payload, ack } });
