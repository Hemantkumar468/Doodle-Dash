import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { History as HistoryIcon, LogOut, Medal, RotateCcw, Sparkles, Trophy } from 'lucide-react';
import Leaderboard from '../components/Leaderboard';
import { Button } from '../components/ui';
import { selectIsHost } from '../features/room/roomSlice';
import { clearSession } from '../lib/session';
import { messages } from '../lib/messages';
import { emitSocket } from '../middleware/socketMiddleware';

export default function GameOver() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const roomId = useSelector((state) => state.room.roomId);
  const result = useSelector((state) => state.game.gameOver) || {};
  const isHost = useSelector(selectIsHost);
  const leaderboard = result.leaderboard || [];
  const podium = leaderboard.slice(0, 3);
  const topScore = Number(leaderboard[0]?.score) || 0;
  const tiedWinners = leaderboard.filter((player) => Number(player.score) === topScore);
  const resultTitle = !leaderboard.length
    ? messages.gameOver.title
    : tiedWinners.length > 1
      ? messages.gameOver.tie(tiedWinners.map((player) => player.name).join(', '))
      : messages.gameOver.winner(result.winner?.name || leaderboard[0]?.name || messages.common.player);

  const exitRoom = (target) => {
    dispatch(emitSocket('leave_room', { roomId }));
    clearSession();
    navigate(target);
  };
  const leave = () => exitRoom('/');
  const viewHistory = () => exitRoom(result.historyId ? `/history/${encodeURIComponent(result.historyId)}` : '/history');

  return (
    <main className="app-bg relative flex h-dvh select-none items-center justify-center overflow-hidden p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-[max(.75rem,env(safe-area-inset-top))] sm:p-5">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {Array.from({ length: 16 }, (_, index) => (
          <span key={index} className={`absolute h-2.5 w-1.5 rounded-sm motion-safe:animate-confetti ${index % 3 === 0 ? 'bg-amber-300' : index % 3 === 1 ? 'bg-fuchsia-400' : 'bg-sky-300'}`} style={{ left: `${5 + ((index * 17) % 90)}%`, top: `${-5 - (index % 4) * 8}%`, animationDelay: `${(index % 8) * 120}ms` }} />
        ))}
      </div>
      <section className="surface-dark relative mx-auto max-h-full w-full min-w-0 max-w-4xl overflow-y-auto overscroll-contain shadow-2xl motion-safe:animate-slide-up">
        <header className="relative overflow-hidden border-b border-white/10 bg-gradient-to-br from-amber-300/20 via-fuchsia-400/10 to-transparent px-4 py-6 text-center sm:px-8 sm:py-8">
          <Sparkles className="absolute left-6 top-6 h-5 w-5 text-amber-200/70" aria-hidden="true" />
          <Trophy className="mx-auto h-12 w-12 text-amber-300 drop-shadow-lg sm:h-14 sm:w-14" aria-hidden="true" />
          <p className="mt-3 text-xs font-bold uppercase tracking-[.24em] text-amber-200">{messages.gameOver.title}</p>
          <h1 className="mx-auto mt-1 max-w-2xl break-words font-display text-3xl font-bold leading-tight text-white sm:text-5xl">{resultTitle}</h1>
          {!!leaderboard.length && <p className="mt-2 whitespace-nowrap text-lg font-bold tabular-nums text-violet-100">{messages.gameOver.points(topScore)}</p>}
        </header>

        <div className="min-w-0 p-3 sm:p-6 md:grid md:grid-cols-[minmax(0,.95fr)_minmax(0,1.25fr)] md:items-start md:gap-x-6">
          {!!podium.length && (
            <section aria-labelledby="podium-title">
              <h2 id="podium-title" className="mb-3 text-center text-sm font-bold uppercase tracking-wider text-violet-200">{messages.gameOver.topPlayers}</h2>
              <div className="grid min-w-0 grid-cols-3 items-end gap-2 sm:gap-3">
                {podium.map((player, index) => (
                  <div key={player.playerId} className={`flex min-w-0 flex-col items-center rounded-2xl border p-2 text-center sm:p-4 ${index === 0 ? 'border-amber-300/50 bg-amber-300/10 sm:pb-6 sm:pt-6' : 'border-white/10 bg-white/[.05]'}`}>
                    {index === 0 ? <Trophy className="h-6 w-6 text-amber-300" aria-label={messages.gameOver.place(index + 1)} /> : <Medal className={`h-6 w-6 ${index === 1 ? 'text-slate-200' : 'text-orange-300'}`} aria-label={messages.gameOver.place(index + 1)} />}
                    <span className="mt-2 min-w-0 break-words text-sm font-bold leading-tight text-white sm:text-base">{player.name}</span>
                    <span className="mt-1 whitespace-nowrap text-xs font-bold tabular-nums text-violet-200 sm:text-sm">{Number(player.score) || 0}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="mt-5 md:mt-0" aria-labelledby="leaderboard-title">
            <h2 id="leaderboard-title" className="mb-3 text-sm font-bold uppercase tracking-wider text-violet-200">{messages.gameOver.finalScores}</h2>
            <Leaderboard leaderboard={leaderboard} winner={result.winner} />
          </section>

          {!isHost && <p className="mt-5 rounded-2xl border border-sky-300/20 bg-sky-300/10 p-3 text-center text-sm font-semibold leading-snug text-sky-100 md:col-span-2">{messages.gameOver.waitingHost}</p>}
          <div className={`mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 md:col-span-2 ${isHost ? 'lg:grid-cols-3' : ''}`}>
            {isHost && <Button full onClick={() => dispatch(emitSocket('start_game', { roomId, playAgain: true }))}><RotateCcw className="h-4 w-4" aria-hidden="true" />{messages.gameOver.playAgain}</Button>}
            <Button full variant="secondary" onClick={viewHistory}><HistoryIcon className="h-4 w-4" aria-hidden="true" />{messages.history.viewGame}</Button>
            <Button full variant={isHost ? 'secondary' : 'primary'} onClick={leave}><LogOut className="h-4 w-4" aria-hidden="true" />{messages.gameOver.leaveRoom}</Button>
          </div>
        </div>
      </section>
    </main>
  );
}
