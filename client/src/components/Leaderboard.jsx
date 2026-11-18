import { memo } from 'react';
import { CircleUserRound, Medal, Trophy } from 'lucide-react';
import { messages } from '../lib/messages';

function Leaderboard({ leaderboard = [], winner }) {
  if (!leaderboard.length) {
    return <p className="rounded-2xl border border-white/10 bg-white/[.06] p-4 text-center text-sm font-semibold text-violet-200" role="status">{messages.gameOver.noScores}</p>;
  }
  return (
    <ol className="min-w-0 space-y-2" aria-label={messages.gameOver.finalScores}>
      {leaderboard.map((player, index) => {
        const rank = player.rank || index + 1;
        const RankIcon = rank === 1 ? Trophy : rank <= 3 ? Medal : null;
        return (
          <li key={player.playerId} className={`grid min-w-0 grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border p-2.5 sm:gap-3 sm:p-3 ${rank === 1 ? 'border-amber-300/40 bg-amber-300/10' : 'border-white/10 bg-white/[.05]'}`}>
            <span className={`flex w-8 items-center justify-center text-sm font-bold ${rank === 1 ? 'text-amber-300' : 'text-violet-300'}`} aria-label={messages.players.rank(rank)}>{RankIcon ? <RankIcon className="h-5 w-5" aria-hidden="true" /> : rank}</span>
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-violet-400/10 text-2xl" aria-hidden="true">{player.avatar || <CircleUserRound className="h-5 w-5 text-violet-200" />}</span>
            <span className="min-w-0 break-words font-bold leading-tight text-white">{player.name || messages.players.defaultName}</span>
            <span className="whitespace-nowrap text-sm font-bold tabular-nums text-violet-100 sm:text-base">{messages.players.points(Number(player.score) || 0)}</span>
          </li>
        );
      })}
    </ol>
  );
}

export default memo(Leaderboard);
