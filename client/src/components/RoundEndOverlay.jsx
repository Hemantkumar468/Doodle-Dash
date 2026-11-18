import { useEffect, useState } from 'react';
import { ArrowUp, CircleUserRound, Clock3 } from 'lucide-react';
import { BottomSheet } from './ui';
import { messages } from '../lib/messages';

export default function RoundEndOverlay({ result }) {
  const [secondsLeft, setSecondsLeft] = useState(4);

  useEffect(() => {
    setSecondsLeft(4);
    const timer = window.setInterval(() => setSecondsLeft((current) => Math.max(1, current - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [result]);

  if (!result) return null;
  return (
    <BottomSheet title={messages.roundEnd.title} className="md:max-w-xl">
      <p className="mt-3 break-words text-center font-display text-3xl font-bold leading-tight text-amber-300 sm:text-4xl">{messages.roundEnd.wordWas(result.word || messages.game.unknownWord)}</p>
      <div className="mt-5 max-h-[42dvh] space-y-2 overflow-y-auto overscroll-contain pr-1" aria-label={messages.roundEnd.scores}>
        {(result.scores || []).map((score) => (
          <div key={score.playerId} className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-white/10 bg-white/[.06] p-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-violet-400/10 text-2xl" aria-hidden="true">{score.avatar || <CircleUserRound className="h-5 w-5 text-violet-200" />}</span>
            <span className="min-w-0">
              <span className="block break-words font-bold leading-tight text-white">{score.name || messages.players.defaultName}</span>
              <span className="block whitespace-nowrap text-xs font-semibold tabular-nums text-violet-200">{messages.players.points(Number(score.total) || 0)}</span>
            </span>
            <span className={`flex items-center gap-1 whitespace-nowrap font-bold tabular-nums ${Number(score.delta) > 0 ? 'text-emerald-300' : 'text-violet-300'}`}>{Number(score.delta) > 0 && <ArrowUp className="h-4 w-4" aria-hidden="true" />}{messages.roundEnd.gained(Number(score.delta) || 0)}</span>
          </div>
        ))}
        {!(result.scores || []).length && <p className="rounded-xl border border-white/10 bg-white/[.06] p-4 text-center text-sm font-semibold text-violet-200" role="status">{messages.roundEnd.empty}</p>}
      </div>
      <p className="mt-4 flex items-center justify-center gap-2 text-center text-sm font-semibold text-violet-200" aria-live="polite">
        <Clock3 className="h-4 w-4 text-amber-300" aria-hidden="true" />
        {messages.roundEnd.nextTurnIn(secondsLeft)}
      </p>
    </BottomSheet>
  );
}
