import { CalendarDays, ChevronRight, Clock3, Trophy, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { messages } from '../lib/messages';

export function historyGameId(game = {}) {
  return String(game.id || game._id || game.gameId || '');
}

function formatPlayedAt(value) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export default function HistoryGameCard({ game = {}, active = false, compact = false }) {
  const id = historyGameId(game);
  const rank = game.myRank ?? game.rank ?? game.player?.rank ?? 0;
  const score = game.myScore ?? game.finalScore ?? game.score ?? game.player?.finalScore ?? 0;
  const playerCount = game.playerCount ?? game.playersCount ?? game.players?.length ?? 0;
  return (
    <Link
      to={`/history/${encodeURIComponent(id)}`}
      className={`group grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border p-3 transition duration-175 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${active ? 'border-violet-300/60 bg-violet-400/15' : 'border-white/10 bg-white/[.055] hover:border-violet-300/35 hover:bg-white/[.08]'}`}
      aria-current={active ? 'page' : undefined}
    >
      <span className="min-w-0">
        <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-violet-200">
          <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />{formatPlayedAt(game.endedAt || game.createdAt)}</span>
          {!compact && <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" />{messages.history.duration(game.durationSec)}</span>}
        </span>
        <span className="mt-1.5 block font-display text-lg font-semibold text-white">{messages.history.roomCode(game.roomId || '')}</span>
        <span className="mt-1 block text-sm font-semibold text-amber-200">{messages.history.youPlaced(rank, score)}</span>
        {!compact && (
          <span className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-violet-200">
            <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" aria-hidden="true" />{messages.history.players(playerCount)}</span>
            <span className="inline-flex min-w-0 items-center gap-1"><Trophy className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span className="break-words">{messages.history.winner(game.winnerName || messages.common.player)}</span></span>
          </span>
        )}
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-violet-300 transition group-hover:translate-x-0.5" aria-hidden="true" />
    </Link>
  );
}
