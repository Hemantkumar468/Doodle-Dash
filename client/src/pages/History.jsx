import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, History as HistoryIcon, ShieldCheck, Trash2 } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import HistoryGameCard, { historyGameId } from '../components/HistoryGameCard';
import { BottomSheet, Button, EmptyState, Skeleton, Toast } from '../components/ui';
import { useClearHistoryMutation, useGetHistoryQuery, useLazyGetHistoryQuery } from '../features/history/historyApi';
import { messages } from '../lib/messages';

const gamesFrom = (payload) => payload?.games || payload?.items || payload?.history || [];

function HistoryLoading() {
  return <div className="space-y-3" aria-label={messages.loading.game}>{[0, 1, 2].map((item) => <Skeleton key={item} className="h-32 w-full rounded-2xl" />)}</div>;
}

export default function History() {
  const location = useLocation();
  const [games, setGames] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [showClear, setShowClear] = useState(false);
  const [notice, setNotice] = useState(location.state?.deleted ? messages.history.deleted : '');
  const [actionError, setActionError] = useState('');
  const { data, isLoading, isFetching, isError, refetch } = useGetHistoryQuery({ limit: 20 });
  const [loadPage, { isFetching: loadingMore }] = useLazyGetHistoryQuery();
  const [clearHistory, { isLoading: clearing }] = useClearHistoryMutation();

  useEffect(() => { if (data) { setGames(gamesFrom(data)); setNextCursor(data.nextCursor || data.cursor || null); } }, [data]);
  const hasGames = games.length > 0;
  const uniqueGames = useMemo(() => [...new Map(games.map((game) => [historyGameId(game), game])).values()], [games]);

  const loadMore = async () => {
    if (!nextCursor) return;
    try {
      const result = await loadPage({ limit: 20, cursor: nextCursor }).unwrap();
      setGames((current) => [...current, ...gamesFrom(result)]);
      setNextCursor(result.nextCursor || result.cursor || null);
    } catch { setActionError(messages.history.loadError); }
  };
  const clear = async () => {
    try {
      await clearHistory().unwrap();
      setGames([]); setNextCursor(null); setShowClear(false); setNotice(messages.history.cleared);
    } catch { setShowClear(false); setActionError(messages.history.loadError); }
  };

  return (
    <main className="app-bg min-h-dvh px-3 py-5 sm:px-5 lg:py-8">
      <div className="mx-auto w-full max-w-4xl min-w-0">
        <header className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <Link className="secondary-button mb-4 !w-auto" to="/"><ArrowLeft className="h-4 w-4" aria-hidden="true" />{messages.common.goHome}</Link>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-amber-300">{messages.history.eyebrow}</p>
            <h1 className="mt-1 font-display text-3xl font-bold text-white sm:text-4xl">{messages.history.title}</h1>
          </div>
          {hasGames && <Button variant="danger" className="shrink-0 !px-3" aria-label={messages.history.clearAll} onClick={() => setShowClear(true)}><Trash2 className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">{messages.history.clearAll}</span></Button>}
        </header>

        <div className="mt-5 flex items-start gap-2 rounded-2xl border border-sky-300/20 bg-sky-300/10 p-3 text-sm leading-relaxed text-sky-100">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><p>{messages.history.deviceNote}</p>
        </div>
        {notice && <Toast tone="success" className="mt-4" onDismiss={() => setNotice('')}>{notice}</Toast>}
        {actionError && <Toast tone="error" className="mt-4" onDismiss={() => setActionError('')}>{actionError}</Toast>}

        <section className="surface-dark mt-5 p-3 sm:p-5" aria-label={messages.history.title}>
          {isLoading ? <HistoryLoading /> : isError ? (
            <EmptyState icon={<HistoryIcon className="h-6 w-6" />} title={messages.history.loadErrorTitle} hint={messages.history.loadError} action={<Button onClick={refetch}>{messages.common.tryAgain}</Button>} />
          ) : !uniqueGames.length ? (
            <EmptyState icon={<HistoryIcon className="h-6 w-6" />} title={messages.history.emptyTitle} hint={messages.history.emptyHint} action={<Link className="primary-button" to="/">{messages.home.createRoom}</Link>} />
          ) : (
            <div className="space-y-3">{uniqueGames.map((game) => <HistoryGameCard key={historyGameId(game)} game={game} />)}</div>
          )}
          {nextCursor && <Button full variant="secondary" className="mt-4" loading={loadingMore || isFetching} onClick={loadMore}>{loadingMore ? messages.history.loadingMore : messages.history.loadMore}</Button>}
        </section>
      </div>

      {showClear && <BottomSheet title={messages.history.clearTitle} onClose={() => setShowClear(false)}><p className="mt-3 text-center text-violet-200">{messages.history.clearText}</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><Button full variant="secondary" onClick={() => setShowClear(false)}>{messages.common.cancel}</Button><Button full variant="danger" loading={clearing} onClick={clear}>{messages.history.clearConfirm}</Button></div></BottomSheet>}
    </main>
  );
}
