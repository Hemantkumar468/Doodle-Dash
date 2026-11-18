import { useCallback, useEffect, useRef, useState } from 'react';
import { DoorOpen, LoaderCircle, MonitorUp, TicketCheck } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import ConnectionBanner from '../components/ConnectionBanner';
import ErrorBoundary from '../components/ErrorBoundary';
import { Button, FormField, Toast } from '../components/ui';
import { historyReceived } from '../features/chat/chatSlice';
import { gameStateReceived } from '../features/game/gameSlice';
import { hydrateRoom, noticeCleared, roomConnecting, roomFailed, roomNotice } from '../features/room/roomSlice';
import { sessionSet } from '../features/session/sessionSlice';
import { replaceCanvasHistory, splitCanvasSnapshot } from '../lib/canvasHistory';
import { getErrorCode, getFriendlyError, messages } from '../lib/messages';
import { getDeviceId } from '../lib/device';
import { clearSession, readProfile, readSession, saveProfile, saveSession } from '../lib/session';
import { socket } from '../lib/socket';
import Game from './Game';
import GameOver from './GameOver';
import Lobby from './Lobby';

const attempts = new Map();

function unpack(response) {
  if (!response) return { error: { code: 'NO_RESPONSE' } };
  if (response.ok === false || response.success === false || response.error) return { error: response.error || { code: response.code } };
  return { data: response.data || response };
}

function validateName(value) {
  const clean = value.trim();
  if (!clean) return messages.validation.nameEmpty;
  if ([...clean].length > 20) return messages.validation.nameTooLong;
  return '';
}

const EXIT_ROOM_ERRORS = new Set(['ROOM_NOT_FOUND', 'ROOM_FULL', 'GAME_ALREADY_STARTED', 'PLAYER_NOT_FOUND', 'KICKED', 'ROOM_CLOSED']);

function InviteForm({ roomId, onJoin, error, busy, canRetry = true }) {
  const saved = readProfile();
  const [name, setName] = useState(saved.name || '');
  const [avatar, setAvatar] = useState(saved.avatar || '🦊');
  const [nameError, setNameError] = useState('');
  const avatars = ['🦊', '🐼', '🐸', '🐙', '🦄', '🐯', '🐨', '🐧', '🤖', '👻'];
  const join = () => {
    const fieldError = validateName(name);
    setNameError(fieldError);
    if (fieldError) return;
    const clean = name.trim();
    saveProfile({ name: clean, avatar });
    onJoin(clean, avatar);
  };
  const submit = (event) => { event.preventDefault(); join(); };
  return (
    <main className="app-bg flex min-h-dvh items-center justify-center overflow-x-hidden px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(.75rem,env(safe-area-inset-left))] pr-[max(.75rem,env(safe-area-inset-right))] pt-[max(1rem,env(safe-area-inset-top))]">
      <form className="surface-dark w-full min-w-0 max-w-md p-5 sm:p-6" onSubmit={submit}>
        <div className="text-center"><TicketCheck className="mx-auto h-11 w-11 text-amber-300" aria-hidden="true" /><h1 className="mt-3 font-display text-2xl font-bold text-white">{messages.invite.title}</h1><p className="mt-1 font-mono text-violet-200">{messages.invite.room(roomId)}</p></div>
        <FormField className="mt-5" label={messages.fields.name.label} helper={messages.fields.name.helper} error={nameError} value={name} onChange={(event) => { setName(event.target.value); if (nameError) setNameError(validateName(event.target.value)); }} onBlur={() => setNameError(validateName(name))} maxLength={40} placeholder={messages.fields.name.placeholder} inputMode="text" autoComplete="off" autoCapitalize="words" enterKeyHint="go" />
        <fieldset className="mt-4 min-w-0"><legend className="mb-1.5 text-base font-bold leading-snug text-white">{messages.fields.avatar.label}</legend><div className="mobile-scroll-row -mx-1 px-1 py-1" aria-label={messages.fields.avatar.label}>{avatars.map((item) => <button key={item} type="button" className={`flex h-12 w-12 snap-start shrink-0 items-center justify-center rounded-xl border text-2xl transition active:scale-95 focus-visible:outline-none ${item === avatar ? 'border-amber-300 bg-amber-300/15 ring-2 ring-amber-300/30' : 'border-white/10 bg-white/[.06]'}`} onClick={() => setAvatar(item)} aria-label={messages.a11y.chooseCharacter(item)} aria-pressed={item === avatar}>{item}</button>)}</div></fieldset>
        {error && <Toast tone="error" role="alert" duration={0} className="mt-4" action={canRetry ? <Button variant="secondary" className="shrink-0 !px-3" onClick={join}>{messages.common.tryAgain}</Button> : <a className="secondary-button shrink-0 !w-auto !px-3" href="/">{messages.common.goHome}</a>}>{error}</Toast>}
        <Button type="submit" full className="mt-5" disabled={busy}>{busy ? messages.loading.joining : messages.invite.join}</Button>
        {canRetry && <a className="secondary-button mt-2 w-full" href="/">{messages.common.goHome}</a>}
      </form>
    </main>
  );
}

export default function RoomRoute() {
  const params = useParams();
  const roomId = String(params.roomId || '').trim().toUpperCase();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const room = useSelector((state) => state.room);
  const phase = useSelector((state) => state.game.phase);
  const status = useSelector((state) => state.session.socketStatus);
  const replaced = useSelector((state) => state.session.replaced);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const mounted = useRef(true);

  const apply = useCallback((data, identity) => {
    const split = splitCanvasSnapshot(data.snapshot || data);
    const snapshot = split.snapshot;
    if (split.strokeHistory !== null) replaceCanvasHistory(split.strokeHistory);
    const actualRoomId = String(data.roomId || snapshot.roomId || snapshot.room?.roomId || roomId).toUpperCase();
    const playerId = data.playerId || data.player?.id || identity.playerId;
    const session = { roomId: actualRoomId, playerId, name: data.name || data.player?.name || identity.name, avatar: data.avatar || data.player?.avatar || identity.avatar };
    if (playerId) { saveSession(session); dispatch(sessionSet(session)); }
    dispatch(hydrateRoom(snapshot));
    dispatch(gameStateReceived(snapshot));
    if (identity.name && session.name !== identity.name) dispatch(roomNotice({ message: messages.errors.nameTaken, tone: 'info' }));
    if (snapshot.messages || snapshot.chat) dispatch(historyReceived(snapshot.messages || snapshot.chat));
    setBusy(false); setTimedOut(false); setError(''); setErrorCode('');
  }, [dispatch, roomId]);

  const handleError = useCallback((failure) => {
    const code = getErrorCode(failure);
    const message = getFriendlyError(failure);
    if (import.meta.env.DEV) console.debug('[room]', failure);
    const friendlyFailure = { code, message };
    setBusy(false); setError(message); setErrorCode(code); dispatch(roomFailed(friendlyFailure));
    if (code === 'ROOM_NOT_FOUND' || code === 'PLAYER_NOT_FOUND') {
      clearSession();
    }
  }, [dispatch]);

  const send = useCallback((event, payload, identity) => {
    if (!socket.connected) { socket.connect(); return; }
    const key = `${event}:${roomId}:${socket.id}`;
    if (attempts.get(key) === 'pending' || attempts.get(key) === 'done') return;
    attempts.set(key, 'pending'); setBusy(true); setTimedOut(false); dispatch(roomConnecting(roomId));
    socket.timeout(7000).emit(event, payload, (timeoutError, response) => {
      if (!mounted.current) return;
      if (timeoutError) {
        if (import.meta.env.DEV) console.debug('[room request]', timeoutError);
        attempts.delete(key); setBusy(false); setTimedOut(true); return;
      }
      const result = unpack(response);
      if (result.error) { attempts.delete(key); handleError(result.error); return; }
      attempts.set(key, 'done'); apply(result.data, identity);
    });
  }, [apply, dispatch, handleError, roomId]);

  const enter = useCallback(() => {
    const saved = readSession();
    if (saved?.roomId?.toUpperCase() === roomId && saved.playerId) {
      send('rejoin_room', { roomId, playerId: saved.playerId }, saved);
      return;
    }
    const profile = readProfile();
    if (profile.name) send('join_room', { roomId, playerName: profile.name, avatar: profile.avatar || '🦊', deviceId: getDeviceId() }, profile);
  }, [roomId, send]);

  const retry = useCallback(() => {
    setTimedOut(false);
    setError('');
    setErrorCode('');
    if (socket.connected) enter();
    else socket.connect();
  }, [enter]);

  const retryRoomNotice = useCallback(() => {
    dispatch(noticeCleared());
    attempts.clear();
    retry();
  }, [dispatch, retry]);

  useEffect(() => {
    mounted.current = true;
    const saved = readSession();
    const alreadyHere = room.status === 'joined' && room.roomId === roomId && saved?.roomId === roomId;
    if (!alreadyHere) enter();
    const onConnect = () => {
      const current = readSession();
      if (current?.roomId?.toUpperCase() === roomId) send('rejoin_room', { roomId, playerId: current.playerId }, current);
      else enter();
    };
    socket.on('connect', onConnect);
    return () => { mounted.current = false; socket.off('connect', onConnect); };
  }, [enter, roomId, send]);

  useEffect(() => {
    if (status === 'connected') {
      setTimedOut(false);
      return undefined;
    }
    setTimedOut(false);
    const timeout = window.setTimeout(() => setTimedOut(true), 8000);
    return () => window.clearTimeout(timeout);
  }, [status]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      const current = readSession();
      if (!current?.playerId || current.roomId?.toUpperCase() !== roomId) return;
      if (!socket.connected) {
        socket.connect();
        return;
      }
      socket.timeout(7000).emit('rejoin_room', { roomId, playerId: current.playerId }, (timeoutError, response) => {
        if (!mounted.current) return;
        if (timeoutError) {
          if (import.meta.env.DEV) console.debug('[room refresh]', timeoutError);
          setTimedOut(true);
          return;
        }
        const result = unpack(response);
        if (result.error) {
          handleError(result.error);
          return;
        }
        apply(result.data, current);
      });
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [apply, handleError, roomId]);

  useEffect(() => {
    if (!['KICKED', 'ROOM_NOT_FOUND', 'PLAYER_NOT_FOUND', 'ROOM_CLOSED'].includes(room.error?.code)) return;
    const message = getFriendlyError(room.error);
    clearSession();
    setBusy(false);
    setError(message);
    setErrorCode(getErrorCode(room.error));
  }, [room.error]);

  useEffect(() => {
    if (!room.notice) return undefined;
    const timer = window.setTimeout(() => dispatch(noticeCleared()), 4000);
    return () => window.clearTimeout(timer);
  }, [dispatch, room.notice]);

  if (replaced) return <main className="app-bg flex min-h-dvh items-center justify-center p-4"><section className="surface-dark max-w-md p-7 text-center"><MonitorUp className="mx-auto h-11 w-11 text-amber-300" aria-hidden="true" /><h1 className="mt-4 font-display text-2xl font-bold text-white">{messages.room.replacedTitle}</h1><p className="mt-2 text-violet-200">{messages.room.replacedText}</p><Button className="mt-5" onClick={() => navigate('/')}>{messages.common.goHome}</Button></section></main>;

  const saved = readSession();
  const profile = readProfile();
  const canRetry = !EXIT_ROOM_ERRORS.has(errorCode);
  const roomNoticeCanRetry = room.notice
    && room.notice.tone !== 'info'
    && !['RATE_LIMITED', 'CANNOT_GUESS', 'NOT_DRAWER', 'NOT_HOST', 'NOT_ENOUGH_PLAYERS'].includes(getErrorCode(room.notice));
  if (room.status !== 'joined' && !saved?.playerId && !profile.name) return <InviteForm roomId={roomId} busy={busy} error={error} canRetry={canRetry} onJoin={(name, avatar) => send('join_room', { roomId, playerName: name, avatar, deviceId: getDeviceId() }, { name, avatar })} />;
  if (room.status !== 'joined' && error && !busy) return <main className="app-bg flex min-h-dvh items-center justify-center p-4"><section className="surface-dark w-full max-w-md p-7 text-center" role="alert"><DoorOpen className="mx-auto h-11 w-11 text-rose-300" aria-hidden="true" /><h1 className="mt-4 font-display text-2xl font-bold text-white">{messages.room.joinProblemTitle}</h1><p className="mt-2 text-violet-200">{error}</p><div className={`mt-5 grid gap-3 ${canRetry ? 'sm:grid-cols-2' : ''}`}>{canRetry && <Button full onClick={retry}>{messages.common.tryAgain}</Button>}<Button full variant="secondary" onClick={() => navigate('/')}>{messages.common.goHome}</Button></div></section></main>;
  if (room.status !== 'joined') return <main className="app-bg flex min-h-dvh items-center justify-center p-4"><ConnectionBanner status={status} timedOut={timedOut} onRetry={retry} onHome={() => navigate('/')} /><div className="text-center text-white" role="status" aria-live="polite"><LoaderCircle className="mx-auto h-12 w-12 animate-spin text-amber-300 motion-reduce:animate-none" aria-hidden="true" /><p className="mt-4 font-display text-xl font-bold">{messages.loading.joining}</p><p className="mt-1 font-mono text-sm text-violet-200">{messages.room.label(roomId)}</p><p className="mt-1 text-sm text-violet-200">{messages.loading.usuallyQuick}</p></div></main>;

  return (
    <ErrorBoundary>
      <ConnectionBanner status={status} timedOut={timedOut} onRetry={retry} onHome={() => navigate('/')} />
      {room.notice && (
        <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-4">
          <Toast
            tone={room.notice.tone || 'error'}
            role={room.notice.tone === 'info' ? 'status' : 'alert'}
            duration={0}
            className="pointer-events-auto w-full max-w-md"
            onDismiss={() => dispatch(noticeCleared())}
            action={<Button variant="secondary" className="shrink-0 !px-3" onClick={roomNoticeCanRetry ? retryRoomNotice : () => dispatch(noticeCleared())}>{roomNoticeCanRetry ? messages.common.tryAgain : messages.common.close}</Button>}
          >
            {room.notice.tone === 'info' ? room.notice.message : getFriendlyError(room.notice)}
          </Toast>
        </div>
      )}
      {phase === 'LOBBY' ? <Lobby /> : phase === 'GAME_OVER' ? <GameOver /> : <Game />}
    </ErrorBoundary>
  );
}
