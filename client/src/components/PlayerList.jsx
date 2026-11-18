import { Check, Crown, Pencil, Users, WifiOff, X } from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { selectSortedPlayers } from '../features/room/roomSlice';
import { messages } from '../lib/messages';
import { IconButton } from './ui';

function PlayerList({ lobby = false, onKick }) {
  const players = useSelector(selectSortedPlayers);
  const selfId = useSelector((state) => state.session.playerId);
  const drawerId = useSelector((state) => state.game.drawerId);
  const isHost = players.find((player) => player.id === selfId)?.isHost;
  const previousScores = useRef(new Map());
  const [scoreChanges, setScoreChanges] = useState({});

  useEffect(() => {
    const changes = {};
    const nextScores = new Map();
    for (const player of players) {
      const score = Number(player.score) || 0;
      const previous = previousScores.current.get(player.id);
      if (Number.isFinite(previous) && score > previous) changes[player.id] = score - previous;
      nextScores.set(player.id, score);
    }
    previousScores.current = nextScores;
    if (!Object.keys(changes).length) return undefined;
    setScoreChanges(changes);
    const timer = window.setTimeout(() => setScoreChanges({}), 1600);
    return () => window.clearTimeout(timer);
  }, [players]);

  if (!players.length) {
    return (
      <div className="flex min-h-32 flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[.03] p-4 text-center" role="status">
        <Users className="text-violet-300" aria-hidden="true" size={28} />
        <p className="mt-2 text-sm font-medium leading-relaxed text-violet-200">{messages.players.empty}</p>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-1.5" aria-label={messages.players.listLabel}>
      {players.map((player, index) => {
        const isSelf = player.id === selfId;
        const isDrawer = player.id === drawerId;
        const disconnected = player.isConnected === false;
        const delta = scoreChanges[player.id];
        return (
          <div
            key={player.id}
            className={`relative flex min-h-14 min-w-0 items-center gap-2 rounded-xl border px-2 py-1.5 transition duration-150 ${
              isSelf ? 'border-violet-300/60 ring-1 ring-violet-300/50' : 'border-white/[.08]'
            } ${disconnected ? 'bg-slate-800/35 text-slate-400' : 'bg-white/[.045] text-white hover:bg-white/[.07]'}`}
          >
            {!lobby && (
              <span className="w-5 shrink-0 text-center text-xs font-bold tabular-nums text-violet-300" aria-label={messages.players.rank(index + 1)}>
                {index + 1}
              </span>
            )}

            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-amber-200/95 to-fuchsia-200/95 text-xl shadow-inner" aria-hidden="true">
              {player.avatar || '🙂'}
              {player.isHost && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-300 text-violet-950 ring-2 ring-violet-950">
                  <Crown size={10} strokeWidth={3} />
                </span>
              )}
              {!lobby && isDrawer && (
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-violet-300 text-violet-950 ring-2 ring-violet-950">
                  <Pencil size={9} strokeWidth={3} />
                </span>
              )}
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight text-current">
                {player.name || messages.players.defaultName}{isSelf ? ` (${messages.players.you})` : ''}
              </p>
              {disconnected ? (
                <span className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-[11px] font-medium text-slate-400">
                  <WifiOff aria-hidden="true" size={11} />
                  {messages.players.reconnecting}
                </span>
              ) : lobby ? (
                <span className={`mt-0.5 block truncate text-[11px] font-medium ${player.isReady || player.isHost ? 'text-emerald-300' : 'text-violet-300'}`}>
                  {player.isHost ? messages.players.roomHost : player.isReady ? messages.players.ready : messages.players.notReady}
                </span>
              ) : isDrawer ? (
                <span className="mt-0.5 block truncate text-[11px] font-medium text-amber-200">{messages.players.drawing}</span>
              ) : null}
            </div>

            {!lobby && (
              <div className="relative ml-auto flex shrink-0 items-center gap-1.5 pl-1">
                {player.hasGuessed && <Check className="text-emerald-300" aria-label={messages.players.guessed} size={17} strokeWidth={3} />}
                <span className="whitespace-nowrap text-xs font-bold tabular-nums text-violet-100">{Number(player.score) || 0}</span>
                {delta ? <span className="absolute -right-0 -top-4 animate-pop whitespace-nowrap text-[10px] font-bold text-emerald-300">{messages.roundEnd.gained(delta)}</span> : null}
              </div>
            )}

            {lobby && isHost && !player.isHost && onKick && (
              <IconButton
                label={messages.players.remove(player.name || messages.players.defaultName)}
                className="!min-h-11 !min-w-11 !border-red-400/25 !bg-red-400/10 !text-red-200 hover:!bg-red-400/20"
                onClick={() => onKick(player.id)}
              >
                <X aria-hidden="true" size={18} />
              </IconButton>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default memo(PlayerList);
