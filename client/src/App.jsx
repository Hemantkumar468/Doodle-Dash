import { lazy, Suspense, useEffect } from 'react';
import { MapPinOff } from 'lucide-react';
import { useSelector } from 'react-redux';
import { Route, Routes, useLocation } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import { messages } from './lib/messages';
import { socket } from './lib/socket';

const Home = lazy(() => import('./pages/Home'));
const RoomRoute = lazy(() => import('./pages/RoomRoute'));
const History = lazy(() => import('./pages/History'));
const HistoryDetails = lazy(() => import('./pages/HistoryDetails'));

function RouteFallback() {
  return (
    <main className="app-bg flex min-h-dvh items-center justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="text-center text-white" role="status" aria-live="polite">
        <span className="mx-auto block h-11 w-11 animate-spin rounded-full border-4 border-white/25 border-t-white motion-reduce:animate-none" />
        <span className="mt-3 block font-bold">{messages.loading.game}</span>
        <span className="mt-1 block text-sm text-violet-200">{messages.loading.usuallyQuick}</span>
      </div>
    </main>
  );
}

function NotFound() {
  return <main className="app-bg flex min-h-dvh items-center justify-center p-4"><section className="surface-dark w-full max-w-md p-7 text-center"><MapPinOff className="mx-auto h-12 w-12 text-amber-300" aria-hidden="true" /><h1 className="mt-4 font-display text-3xl font-bold text-white">{messages.notFound.title}</h1><p className="mt-2 text-violet-200">{messages.notFound.text}</p><a className="primary-button mt-6 inline-flex items-center" href="/">{messages.notFound.action}</a></section></main>;
}

export default function App() {
  const location = useLocation();
  const phase = useSelector((state) => state.game.phase);
  const roomId = useSelector((state) => state.room.roomId);
  useEffect(() => { if (!socket.connected) socket.connect(); }, []);
  useEffect(() => {
    if (location.pathname === '/') document.title = messages.titles.home;
    else if (location.pathname === '/history') document.title = messages.titles.history;
    else if (location.pathname.startsWith('/history/')) document.title = messages.titles.historyGame;
    else if (phase === 'LOBBY') document.title = messages.titles.lobby(roomId || location.pathname.split('/').at(-1) || '');
    else if (phase === 'GAME_OVER') document.title = messages.titles.gameOver;
    else document.title = messages.titles.game;
  }, [location.pathname, phase, roomId]);
  return (
    <ErrorBoundary>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/history" element={<History />} />
          <Route path="/history/:gameId" element={<HistoryDetails />} />
          <Route path="/room/:roomId" element={<RoomRoute />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
