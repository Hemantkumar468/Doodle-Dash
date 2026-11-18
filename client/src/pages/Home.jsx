import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, History as HistoryIcon, RefreshCw, Users } from 'lucide-react';
import BrandMark from '../components/BrandMark';
import { hydrateRoom, roomNotice } from '../features/room/roomSlice';
import { gameStateReceived } from '../features/game/gameSlice';
import { sessionSet } from '../features/session/sessionSlice';
import { SERVER_URL } from '../lib/config';
import { getDeviceId } from '../lib/device';
import { replaceCanvasHistory, splitCanvasSnapshot } from '../lib/canvasHistory';
import { getErrorCode, getFriendlyError, messages } from '../lib/messages';
import { readProfile, saveProfile, saveSession } from '../lib/session';
import { socket } from '../lib/socket';
import { Button, FormField, IconButton, Toast } from '../components/ui';

const avatars = ['🦊', '🐼', '🐸', '🐙', '🦄', '🐯', '🐨', '🐧', '🦁', '🐵', '🐰', '🤖', '👻', '🧙'];
const initialSettings = { maxPlayers: 8, rounds: 3, drawTime: 80, wordChoices: 3, hints: 2, wordMode: 'Normal', isPrivate: true, customWords: '' };

function unpack(response) {
  if (!response) return { error: { code: 'NO_RESPONSE' } };
  if (response.ok === false || response.success === false || response.error) {
    return { error: response.error || { code: response.code } };
  }
  return { data: response.data || response };
}

function validateName(value) {
  const clean = value.trim();
  if (!clean) return messages.validation.nameEmpty;
  if ([...clean].length > 20) return messages.validation.nameTooLong;
  return '';
}

function validateRoomCode(value) {
  if (!value.trim()) return messages.validation.roomCodeEmpty;
  if (value.trim().length !== 6) return messages.validation.roomCodeLength;
  return '';
}

export default function Home() {
  const saved = readProfile();
  const [name, setName] = useState(saved.name || '');
  const [avatar, setAvatar] = useState(saved.avatar || '🦊');
  const [code, setCode] = useState('');
  const [online, setOnline] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [nameError, setNameError] = useState('');
  const [codeError, setCodeError] = useState('');
  const [error, setError] = useState('');
  const [errorAction, setErrorAction] = useState('retry');
  const [rooms, setRooms] = useState([]);
  const codeRef = useRef(null);
  const lastAttempt = useRef(null);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!location.state?.error) return;
    const codeValue = getErrorCode(location.state.error);
    setError(getFriendlyError(location.state.error));
    setErrorAction(['ROOM_NOT_FOUND', 'ROOM_FULL', 'GAME_ALREADY_STARTED', 'PLAYER_NOT_FOUND'].includes(codeValue) ? 'code' : 'retry');
  }, [location.state]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const health = await fetch(`${SERVER_URL}/health`, { signal: AbortSignal.timeout(4000) });
      if (!health.ok) throw new Error('offline');
      setOnline(true);
      try {
        const list = await fetch(`${SERVER_URL}/rooms/public`, { signal: AbortSignal.timeout(4000) });
        if (list.ok) {
          const body = await list.json();
          setRooms(Array.isArray(body) ? body : body.rooms || []);
        } else setRooms([]);
      } catch (listError) {
        if (import.meta.env.DEV) console.debug('[rooms]', listError);
        setRooms([]);
      }
    } catch (healthError) {
      if (import.meta.env.DEV) console.debug('[health]', healthError);
      setOnline(false);
      setRooms([]);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const markOnline = () => setOnline(true);
    const markOffline = (detail) => {
      if (import.meta.env.DEV) console.debug('[connection]', detail);
      setOnline(false);
      setRooms([]);
    };
    socket.on('connect', markOnline);
    socket.on('connect_error', markOffline);
    socket.on('disconnect', markOffline);
    return () => {
      socket.off('connect', markOnline);
      socket.off('connect_error', markOffline);
      socket.off('disconnect', markOffline);
    };
  }, []);

  const enter = (event, payload) => {
    const fieldError = validateName(name);
    setNameError(fieldError);
    if (fieldError) return;
    const cleanName = name.trim();
    lastAttempt.current = { event, payload };
    setBusy(true);
    setError('');
    saveProfile({ name: cleanName, avatar });
    if (!socket.connected) socket.connect();
    socket.timeout(7000).emit(event, payload(cleanName), (timeoutError, response) => {
      setBusy(false);
      if (timeoutError) {
        if (import.meta.env.DEV) console.debug('[room request]', timeoutError);
        setOnline(false);
        setError(getFriendlyError('TIMEOUT'));
        setErrorAction('retry');
        return;
      }
      const result = unpack(response);
      if (result.error) {
        if (import.meta.env.DEV) console.debug('[room request]', result.error);
        const codeValue = getErrorCode(result.error);
        setError(getFriendlyError(result.error));
        setErrorAction(['ROOM_NOT_FOUND', 'ROOM_FULL', 'GAME_ALREADY_STARTED', 'PLAYER_NOT_FOUND'].includes(codeValue) ? 'code' : 'retry');
        return;
      }
      const data = result.data;
      setOnline(true);
      const roomId = String(data.roomId || data.room?.roomId || '').toUpperCase();
      const playerId = data.playerId || data.player?.id;
      if (!roomId || !playerId) {
        if (import.meta.env.DEV) console.debug('[room response] Missing room or player id', data);
        setError(getFriendlyError('INVALID_PAYLOAD'));
        setErrorAction('retry');
        return;
      }
      const session = {
        roomId,
        playerId,
        name: data.name || data.player?.name || cleanName,
        avatar: data.avatar || data.player?.avatar || avatar,
      };
      saveSession(session);
      dispatch(sessionSet(session));
      const { snapshot, strokeHistory } = splitCanvasSnapshot(data.snapshot || data);
      if (strokeHistory !== null) replaceCanvasHistory(strokeHistory);
      dispatch(hydrateRoom(snapshot));
      dispatch(gameStateReceived(snapshot));
      if (session.name !== cleanName) dispatch(roomNotice({ message: messages.errors.nameTaken, tone: 'info' }));
      navigate(`/room/${roomId}`);
    });
  };

  const create = () => enter('create_room', (cleanName) => ({ hostName: cleanName, avatar, deviceId: getDeviceId(), settings: initialSettings }));
  const joinRoom = (requestedCode = code) => {
    const roomId = String(requestedCode).trim().toUpperCase();
    const fieldError = validateRoomCode(roomId);
    setCodeError(fieldError);
    if (fieldError) return;
    setCode(roomId);
    enter('join_room', (cleanName) => ({ roomId, playerName: cleanName, avatar, deviceId: getDeviceId() }));
  };

  const handleErrorAction = () => {
    setError('');
    if (errorAction === 'code') {
      codeRef.current?.focus();
      return;
    }
    if (lastAttempt.current) enter(lastAttempt.current.event, lastAttempt.current.payload);
    else refresh();
  };

  const unavailable = online === false || busy;

  return (
    <main className="app-bg relative min-h-dvh overflow-x-clip px-3 py-5 sm:px-5 lg:py-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-32 top-8 h-80 w-80 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="absolute -right-24 top-1/3 h-72 w-72 rounded-full bg-amber-300/10 blur-3xl" />
      </div>

      <div className="relative mx-auto w-full min-w-0 max-w-xl">
        <div className="min-w-0">
          <header className="mb-5 flex min-w-0 items-center gap-3 lg:mb-6 lg:pt-3">
            <BrandMark className="h-14 w-14 shrink-0 drop-shadow-xl sm:h-16 sm:w-16" />
            <div className="min-w-0">
              <h1 className="break-words font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">{messages.brand.name}</h1>
              <p className="mt-0.5 max-w-xl text-sm font-medium leading-relaxed text-violet-200 sm:text-base">{messages.brand.tagline}</p>
            </div>
            <Button variant="secondary" className="ml-auto shrink-0 !px-3" aria-label={messages.home.history} onClick={() => navigate('/history')}><HistoryIcon className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">{messages.home.history}</span></Button>
          </header>

          {online === null && <Toast tone="info" duration={0} className="mb-3" role="status">{messages.loading.waking}</Toast>}

          {online === false && (
            <Toast tone="error" role="alert" duration={0} className="mb-3" action={<Button variant="secondary" className="shrink-0 !px-3" onClick={refresh}>{messages.common.tryAgain}</Button>}>
              {messages.connection.offline}
            </Toast>
          )}

          <section className="surface-dark p-4 sm:p-6" aria-labelledby="play-title">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-300">{messages.home.eyebrow}</p>
              <h2 id="play-title" className="mt-1 break-words font-display text-2xl font-semibold text-white sm:text-3xl">{messages.home.title}</h2>
            </div>

          <FormField
            className="mt-4"
            label={messages.fields.name.label}
            helper={messages.fields.name.helper}
            error={nameError}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (nameError) setNameError(validateName(event.target.value));
            }}
            onBlur={() => setNameError(validateName(name))}
            maxLength={40}
            placeholder={messages.fields.name.placeholder}
            inputMode="text"
            autoComplete="off"
            autoCapitalize="words"
            enterKeyHint="next"
          />

          <fieldset className="mt-5 min-w-0">
            <legend className="mb-2 text-sm font-semibold leading-snug text-violet-100">{messages.fields.avatar.label}</legend>
            <div className="grid min-w-0 grid-cols-5 gap-2 sm:grid-cols-7" aria-label={messages.fields.avatar.label}>
              {avatars.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`flex h-12 w-12 items-center justify-center justify-self-center rounded-full border text-2xl transition duration-150 active:scale-95 motion-reduce:transition-none ${avatar === item ? 'border-amber-300 bg-amber-300/15 ring-2 ring-amber-300 ring-offset-2 ring-offset-violet-950' : 'border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10'}`}
                  onClick={() => setAvatar(item)}
                  aria-label={messages.a11y.chooseCharacter(item)}
                  aria-pressed={avatar === item}
                >
                  {item}
                </button>
              ))}
            </div>
          </fieldset>

          {error && (
            <Toast
              tone="error"
              role="alert"
              duration={0}
              className="mt-3"
              onDismiss={() => setError('')}
              action={<Button variant="secondary" className="shrink-0 !px-3" onClick={handleErrorAction}>{errorAction === 'code' ? messages.home.checkCode : messages.common.tryAgain}</Button>}
            >
              {error}
            </Toast>
          )}

          <Button full className="mt-5 text-base sm:text-lg" onClick={create} disabled={unavailable}>
            {busy ? messages.loading.creating : messages.home.createRoom}
            {!busy && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
          </Button>

          <div className="my-5 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.16em] text-violet-300" aria-hidden="true">
            <span className="h-px flex-1 bg-white/10" />
            <span>{messages.home.orUseCode}</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <div className="grid min-w-0 grid-cols-1 items-end gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <FormField
              ref={codeRef}
              label={messages.fields.roomCode.label}
              error={codeError}
              fieldClassName="min-h-14 px-2 text-center font-mono text-xl font-bold uppercase tracking-[0.16em] placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:normal-case placeholder:tracking-[-.04em] sm:placeholder:text-base"
              value={code}
              onChange={(event) => {
                const next = event.target.value.replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase();
                setCode(next);
                if (codeError) setCodeError(validateRoomCode(next));
              }}
              onBlur={() => setCodeError(validateRoomCode(code))}
              onKeyDown={(event) => event.key === 'Enter' && joinRoom()}
              placeholder={messages.fields.roomCode.placeholder}
              maxLength={6}
              inputMode="text"
              autoComplete="off"
              autoCapitalize="characters"
              enterKeyHint="go"
            />
            <Button variant="secondary" full className="min-h-14 sm:w-auto sm:self-start sm:mt-[1.875rem]" disabled={unavailable} onClick={() => joinRoom()}>
              {messages.home.joinWithCode}
            </Button>
          </div>
          {online === false && <p className="mt-3 text-center text-sm font-semibold text-red-200" role="status">{messages.connection.offlineHelper}</p>}
          </section>
        <section className="surface-dark mt-4 min-w-0 p-4 sm:mt-6" aria-labelledby="rooms-title">
          <div className="flex min-w-0 items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div className="min-w-0">
              <h2 id="rooms-title" className="break-words font-display text-xl font-semibold leading-tight text-white">{messages.home.openRoomsTitle}</h2>
              <p className="mt-1 break-words text-sm text-violet-200">{messages.home.openRoomsHelp}</p>
            </div>
            <IconButton label={refreshing ? messages.home.refreshingRooms : messages.home.refreshRooms} onClick={refresh} disabled={refreshing} className={refreshing ? 'animate-pulse' : ''}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            </IconButton>
          </div>

          <div className="mt-3 max-h-[32rem] space-y-2 overflow-y-auto pr-1" aria-live="polite" aria-busy={refreshing}>
            {rooms.map((room) => (
              <article
                key={room.roomId}
                className="grid min-h-16 w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 transition duration-150 hover:border-white/20 hover:bg-white/[0.08] motion-reduce:transition-none"
              >
                <span className="min-w-0">
                  <span className="block font-mono text-base font-bold tracking-[0.12em] text-amber-300" aria-label={messages.home.roomCode(room.roomId)}>{room.roomId}</span>
                  <span className="mt-0.5 block break-words text-sm font-medium leading-tight text-white">{room.hostName ? messages.home.roomBy(room.hostName) : messages.home.roomCode(room.roomId)}</span>
                  <span className="mt-1 flex flex-wrap gap-x-2 text-xs text-violet-200"><span className="whitespace-nowrap tabular-nums">{messages.home.players(room.playerCount || 0, room.maxPlayers || 8)}</span><span className="whitespace-nowrap tabular-nums">{messages.home.rounds(room.rounds || 3)}</span></span>
                </span>
                <Button variant="secondary" className="shrink-0 !px-3 text-sm" onClick={() => joinRoom(room.roomId)} disabled={unavailable}>
                  {messages.home.joinRoom}
                </Button>
              </article>
            ))}
            {!refreshing && !rooms.length && (
              <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-5 text-center text-violet-200">
                <Users className="mx-auto h-7 w-7 text-violet-300" aria-hidden="true" />
                <p className="mx-auto mt-2 max-w-sm text-sm font-medium leading-relaxed">{messages.home.emptyRooms}</p>
              </div>
            )}
          </div>
        </section>
        </div>
      </div>
    </main>
  );
}
