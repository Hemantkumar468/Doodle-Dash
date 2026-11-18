import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Copy, LogOut, Share2, SlidersHorizontal, Users } from 'lucide-react';
import PlayerList from '../components/PlayerList';
import SettingsForm from '../components/SettingsForm';
import { Button, IconButton, Toast } from '../components/ui';
import { selectIsHost } from '../features/room/roomSlice';
import { getFriendlyError, messages } from '../lib/messages';
import { clearSession } from '../lib/session';
import { emitSocket } from '../middleware/socketMiddleware';

export default function Lobby() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [copyNotice, setCopyNotice] = useState(null);
  const [startError, setStartError] = useState('');
  const roomId = useSelector((state) => state.room.roomId);
  const settings = useSelector((state) => state.room.settings);
  const players = useSelector((state) => state.room.players);
  const selfId = useSelector((state) => state.session.playerId);
  const isHost = useSelector(selectIsHost);
  const self = players.find((player) => player.id === selfId);
  const connectedCount = players.filter((player) => player.isConnected).length;
  const canStart = connectedCount >= 2;

  const copy = async (kind) => {
    const value = kind === 'code' ? roomId : `${window.location.origin}/room/${roomId}`;
    if (kind === 'link' && navigator.share) {
      try {
        await navigator.share({ title: messages.lobby.shareTitle, text: messages.lobby.shareText(roomId), url: value });
        setCopyNotice({ tone: 'success', message: messages.lobby.copiedLink, kind });
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(value);
      setCopyNotice({ tone: 'success', message: kind === 'code' ? messages.lobby.copiedCode : messages.lobby.copiedLink, kind });
    } catch (copyError) {
      if (import.meta.env.DEV) console.debug('[copy]', copyError);
      setCopyNotice({ tone: 'error', message: messages.lobby.copyFailed, kind });
    }
  };

  const leave = () => {
    dispatch(emitSocket('leave_room', { roomId }));
    clearSession();
    navigate('/');
  };
  const update = (next) => dispatch(emitSocket('update_settings', { roomId, settings: next }));
  const toggleReady = () => dispatch(emitSocket('ready_toggle', { roomId }));
  const start = () => {
    setStartError('');
    dispatch(emitSocket('start_game', { roomId }, (response) => {
      if (response?.error || response?.ok === false) {
        setStartError(getFriendlyError(response?.error || response));
      }
    }));
  };

  return (
    <main className="app-bg relative min-h-dvh overflow-x-clip px-3 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5 lg:pb-28">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-24 top-16 h-72 w-72 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="absolute -right-24 bottom-28 h-80 w-80 rounded-full bg-amber-300/10 blur-3xl" />
      </div>
      <div className="relative mx-auto min-w-0 max-w-6xl">
        <header className="mb-4 flex min-w-0 items-center gap-3 pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] text-white lg:mb-5">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[.18em] text-amber-300">{messages.lobby.eyebrow}</p>
            <h1 className="mt-0.5 break-words font-display text-2xl font-semibold leading-tight sm:text-3xl">{messages.lobby.title}</h1>
          </div>
          <IconButton
            label={messages.lobby.leaveRoom}
            className="!border-white/10 !bg-white/5 !text-violet-100 backdrop-blur hover:!bg-white/10"
            onClick={leave}
          >
            <LogOut className="h-5 w-5" aria-hidden="true" />
          </IconButton>
        </header>

        <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(19rem,.82fr)_minmax(0,1.18fr)] lg:items-start lg:gap-5">
          <div className="min-w-0 space-y-4">
            <section className="surface-dark min-w-0 p-4 text-center sm:p-5" aria-labelledby="room-code-title">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <p id="room-code-title" className="text-xs font-bold uppercase tracking-[.2em] text-violet-200">{messages.lobby.roomCode}</p>
                <span className="badge bg-emerald-400/10 text-emerald-200">
                  {messages.lobby.playersCount(players.length, settings.maxPlayers)}
                </span>
              </div>
              <p className="mt-3 break-all font-mono text-4xl font-bold leading-none tracking-[.18em] text-amber-300 sm:text-5xl" aria-label={messages.lobby.roomCodeLabel(roomId)}>{roomId}</p>
              <div className="mt-5 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <Button variant="secondary" full className="min-w-0" onClick={() => copy('code')}>
                  <Copy className="h-4 w-4" aria-hidden="true" />{messages.lobby.copyCode}
                </Button>
                <Button variant="secondary" full className="min-w-0" onClick={() => copy('link')}>
                  <Share2 className="h-4 w-4" aria-hidden="true" />{navigator.share ? messages.lobby.shareInvite : messages.lobby.copyInvite}
                </Button>
              </div>
              {copyNotice && <Toast tone={copyNotice.tone} className="mt-3 flex-wrap text-left" onDismiss={() => setCopyNotice(null)} action={copyNotice.tone === 'error' ? <Button variant="secondary" className="shrink-0 !px-3" onClick={() => copy(copyNotice.kind)}>{messages.common.tryAgain}</Button> : null}>{copyNotice.message}</Toast>}
            </section>

            <section className="surface-dark min-w-0 p-4 sm:p-5" aria-labelledby="players-title">
              <div className="mb-3 flex min-w-0 items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Users className="h-4 w-4 shrink-0 text-violet-300" aria-hidden="true" />
                  <div className="min-w-0">
                    <h2 id="players-title" className="text-sm font-semibold uppercase tracking-wide text-violet-100">{messages.lobby.players}</h2>
                    <p className="text-xs text-violet-300">{messages.lobby.playersHelp}</p>
                  </div>
                </div>
                <span className="badge shrink-0 bg-white/5 text-violet-100">{messages.lobby.online(connectedCount)}</span>
              </div>
              <PlayerList lobby onKick={(playerId) => dispatch(emitSocket('kick_player', { roomId, playerId }))} />
            </section>
          </div>

          <section className="surface-dark min-w-0 p-4 sm:p-5" aria-labelledby="settings-title">
            <div className="mb-4 flex min-w-0 items-start gap-2 border-b border-white/10 pb-3">
              <SlidersHorizontal className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" aria-hidden="true" />
              <div className="min-w-0">
                <h2 id="settings-title" className="text-sm font-semibold uppercase tracking-wide text-violet-100">{messages.lobby.settings}</h2>
                <p className="mt-1 text-sm leading-snug text-violet-300">
                {isHost ? messages.lobby.settingsHostHelp : messages.lobby.settingsPlayerHelp}
                </p>
              </div>
            </div>
            <SettingsForm settings={settings} editable={isHost} onChange={update} />
          </section>
        </div>
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-violet-950/85 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2xl backdrop-blur-xl sm:px-5">
        <div className="mx-auto min-w-0 max-w-6xl pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
          {startError && <Toast tone="error" className="mb-2 flex-wrap" onDismiss={() => setStartError('')} action={<Button variant="secondary" className="shrink-0 !px-3" onClick={start}>{messages.common.tryAgain}</Button>}>{startError}</Toast>}
          {isHost ? (
            <div className="min-w-0">
              <Button
                full
                className="!border-amber-300 !bg-amber-300 text-base font-bold !text-violet-950 hover:!bg-amber-200 sm:text-lg"
                disabled={!canStart}
                onClick={start}
              >
                {messages.lobby.startGame} <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
              {!canStart && <p className="mt-1.5 text-center text-xs font-bold text-violet-200">{messages.errors.notEnoughPlayers}</p>}
            </div>
          ) : (
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              <Button
                variant="secondary"
                full
                className={self?.isReady ? 'min-w-0 !border-emerald-300/50 !bg-emerald-400/15 !text-emerald-100' : 'min-w-0'}
                onClick={toggleReady}
                aria-pressed={Boolean(self?.isReady)}
              >
                {self?.isReady && <Check className="h-4 w-4" aria-hidden="true" />}{self?.isReady ? messages.lobby.ready : messages.lobby.readyUp}
              </Button>
              <p className="max-w-32 text-right text-xs font-bold leading-snug text-violet-200 sm:max-w-none sm:text-sm">
                {messages.lobby.waitingHost}
              </p>
            </div>
          )}
        </div>
      </footer>
    </main>
  );
}
