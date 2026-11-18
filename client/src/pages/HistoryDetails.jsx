import { useState } from 'react';
import { ArrowLeft, ChevronDown, Clock3, History as HistoryIcon, Settings2, Trash2, Trophy, Users } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import HistoryGameCard, { historyGameId } from '../components/HistoryGameCard';
import ReplayCanvas from '../components/ReplayCanvas';
import { BottomSheet, Button, EmptyState, Skeleton, Toast } from '../components/ui';
import { useDeleteHistoryGameMutation, useGetHistoryGameQuery, useGetHistoryQuery } from '../features/history/historyApi';
import { messages } from '../lib/messages';
import { readHistoryReplay } from '../lib/historyReplayCache';

const gamesFrom = (payload) => payload?.games || payload?.items || payload?.history || [];

function DetailsLoading() {
  return <div className="space-y-4" aria-label={messages.loading.game}><Skeleton className="h-36 rounded-2xl" /><Skeleton className="h-48 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /></div>;
}

function HistorySidebar({ activeId }) {
  const { data, isLoading } = useGetHistoryQuery({ limit: 20 });
  return (
    <aside className="hidden min-w-0 lg:block" aria-label={messages.history.title}>
      <h2 className="mb-3 font-display text-xl font-semibold text-white">{messages.history.title}</h2>
      <div className="max-h-[calc(100dvh-10rem)] space-y-2 overflow-y-auto pr-1">
        {isLoading ? [0, 1, 2].map((item) => <Skeleton key={item} className="h-28 rounded-2xl" />) : gamesFrom(data).map((game) => <HistoryGameCard key={historyGameId(game)} game={game} active={historyGameId(game) === activeId} compact />)}
      </div>
    </aside>
  );
}

function Leaderboard({ players = [] }) {
  return (
    <ol className="mt-3 space-y-2">
      {[...players].sort((left, right) => (left.rank || 99) - (right.rank || 99)).map((player, index) => (
        <li key={`${player.name}-${player.rank || index}`} className="grid min-w-0 grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-white/10 bg-white/[.05] p-2.5 sm:gap-3">
          <span className="w-7 text-center text-sm font-bold text-amber-300">{player.rank || index + 1}</span>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-200 to-fuchsia-200 text-xl" aria-hidden="true">{player.avatar || '🙂'}</span>
          <span className="min-w-0 truncate font-semibold text-white">{player.name || messages.common.player}</span>
          <span className="whitespace-nowrap text-sm font-bold tabular-nums text-violet-100">{messages.players.points(player.finalScore ?? player.score ?? 0)}</span>
        </li>
      ))}
    </ol>
  );
}

function Setting({ label, value }) {
  return <div className="rounded-xl border border-white/10 bg-white/[.045] p-3"><dt className="text-xs font-semibold uppercase tracking-wide text-violet-300">{label}</dt><dd className="mt-1 break-words font-semibold text-white">{value}</dd></div>;
}

function TurnAccordion({ turn, index, game, gameId }) {
  const [open, setOpen] = useState(index === 0);
  const turnIndex = turn.turnIndex ?? index;
  return (
    <details
      className="group rounded-2xl border border-white/10 bg-white/[.045]"
      defaultOpen={index === 0}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-300">
        <span className="min-w-0">
          <span className="block font-semibold text-white">{messages.history.round(turn.round || 1)} · {messages.history.turn(turnIndex + 1)}</span>
          <span className="mt-0.5 block break-words text-sm text-violet-200">{messages.history.drawer(turn.drawerName || messages.common.player)} · {messages.history.word(turn.word || messages.game.unknownWord)}</span>
        </span>
        <ChevronDown className="h-5 w-5 shrink-0 text-violet-300 transition group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="border-t border-white/10 p-3 sm:p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-violet-200">{messages.history.guessers}</h3>
        {turn.guessers?.length ? (
          <ul className="mt-2 space-y-2">
            {turn.guessers.map((guesser, guessIndex) => (
              <li key={`${guesser.name}-${guessIndex}`} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl bg-white/[.05] p-2.5 text-sm">
                <span className="break-words font-semibold text-white">{messages.history.pointsGained(guesser.name || messages.common.player, guesser.points || 0)}</span>
                <span className="whitespace-nowrap text-violet-300">{messages.history.guessedAt(guesser.guessedAtSec || 0)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="mt-2 text-sm text-violet-300">{messages.history.noGuessers}</p>}
        <p className="mt-3 text-sm font-semibold text-amber-200">{messages.history.drawerPoints(turn.drawerPoints || 0)}</p>
        {open && (
          <div className="mt-4">
            <ReplayCanvas strokes={readHistoryReplay(String(game.id || game._id || gameId), turnIndex)} word={turn.word || ''} endedAt={game.endedAt} />
          </div>
        )}
      </div>
    </details>
  );
}

export default function HistoryDetails() {
  const { gameId = '' } = useParams();
  const navigate = useNavigate();
  const [showDelete, setShowDelete] = useState(false);
  const [actionError, setActionError] = useState('');
  const { data, isLoading, isError, error, refetch } = useGetHistoryGameQuery(gameId);
  const [deleteGame, { isLoading: deleting }] = useDeleteHistoryGameMutation();
  const game = data?.game || data || {};
  const players = game.players || game.leaderboard || [];
  const turns = game.turns || [];
  const settings = game.settings || {};

  const remove = async () => {
    try {
      await deleteGame(gameId).unwrap();
      navigate('/history', { replace: true, state: { deleted: true } });
    } catch {
      setShowDelete(false); setActionError(messages.history.loadError);
    }
  };

  return (
    <main className="app-bg min-h-dvh px-3 py-5 sm:px-5 lg:py-8">
      <div className="mx-auto w-full max-w-6xl min-w-0">
        <Link className="secondary-button mb-5 !w-auto" to="/history"><ArrowLeft className="h-4 w-4" aria-hidden="true" />{messages.history.back}</Link>
        <div className="grid min-w-0 gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <HistorySidebar activeId={gameId} />
          <section className="min-w-0">
            {isLoading ? <DetailsLoading /> : isError ? (
              <section className="surface-dark p-5"><EmptyState icon={<HistoryIcon className="h-6 w-6" />} title={error?.status === 404 ? messages.history.notFoundTitle : messages.history.loadErrorTitle} hint={error?.status === 404 ? messages.history.notFound : messages.history.loadError} action={error?.status === 404 ? <Link className="primary-button" to="/history">{messages.history.back}</Link> : <Button onClick={refetch}>{messages.common.tryAgain}</Button>} /></section>
            ) : (
              <>
                <header className="surface-dark p-4 sm:p-6">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[.18em] text-amber-300">{messages.history.detailsTitle}</p><h1 className="mt-1 break-words font-display text-3xl font-bold text-white">{messages.history.roomCode(game.roomId || '')}</h1><p className="mt-2 text-sm text-violet-200">{new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'short' }).format(new Date(game.endedAt || game.createdAt || Date.now()))}</p></div>
                    <Button variant="danger" className="shrink-0 !px-3" aria-label={messages.history.deleteGame} onClick={() => setShowDelete(true)}><Trash2 className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">{messages.history.deleteGame}</span></Button>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-sm text-violet-100"><span className="badge"><Users className="h-3.5 w-3.5" aria-hidden="true" />{messages.history.players(players.length)}</span><span className="badge"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" />{messages.history.duration(game.durationSec)}</span><span className="badge"><Trophy className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />{messages.history.winner(game.winnerName || players[0]?.name || messages.common.player)}</span></div>
                  {game.endedEarly && <p className="mt-3 rounded-xl border border-amber-300/25 bg-amber-300/10 p-3 text-sm font-semibold text-amber-100">{messages.history.endedEarly}</p>}
                </header>
                {actionError && <Toast tone="error" className="mt-4" onDismiss={() => setActionError('')}>{actionError}</Toast>}

                <div className="mt-5 grid min-w-0 gap-5 xl:grid-cols-2">
                  <section className="surface-dark min-w-0 p-4 sm:p-5" aria-labelledby="history-leaderboard"><h2 id="history-leaderboard" className="flex items-center gap-2 font-display text-xl font-semibold text-white"><Trophy className="h-5 w-5 text-amber-300" aria-hidden="true" />{messages.history.leaderboard}</h2><Leaderboard players={players} /></section>
                  <section className="surface-dark min-w-0 p-4 sm:p-5" aria-labelledby="history-settings"><h2 id="history-settings" className="flex items-center gap-2 font-display text-xl font-semibold text-white"><Settings2 className="h-5 w-5 text-violet-300" aria-hidden="true" />{messages.history.settings}</h2><dl className="mt-3 grid grid-cols-2 gap-2"><Setting label={messages.history.rounds} value={settings.rounds ?? '—'} /><Setting label={messages.history.drawTime} value={messages.history.seconds(settings.drawTime)} /><Setting label={messages.history.wordMode} value={settings.wordMode || '—'} /><Setting label={messages.history.wordCount} value={settings.wordCount ?? settings.wordChoices ?? '—'} /><Setting label={messages.history.hints} value={settings.hints ?? '—'} /></dl></section>
                </div>

                <section className="surface-dark mt-5 p-3 sm:p-5" aria-labelledby="history-turns">
                  <h2 id="history-turns" className="px-1 font-display text-xl font-semibold text-white">{messages.history.turns}</h2>
                  <div className="mt-3 space-y-3">
                    {turns.map((turn, index) => <TurnAccordion key={`${turn.turnIndex ?? index}-${turn.word}`} turn={turn} index={index} game={game} gameId={gameId} />)}
                  </div>
                </section>
              </>
            )}
          </section>
        </div>
      </div>
      {showDelete && <BottomSheet title={messages.history.deleteTitle} onClose={() => setShowDelete(false)}><p className="mt-3 text-center text-violet-200">{messages.history.deleteText}</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><Button full variant="secondary" onClick={() => setShowDelete(false)}>{messages.common.cancel}</Button><Button full variant="danger" loading={deleting} onClick={remove}>{messages.history.deleteConfirm}</Button></div></BottomSheet>}
    </main>
  );
}
