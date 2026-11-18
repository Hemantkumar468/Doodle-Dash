import { memo, useEffect, useState } from 'react';
import { messages } from '../lib/messages';

const CIRCUMFERENCE = 2 * Math.PI * 16;

function Timer({ endsAt, duration = 60, compact = false }) {
  const getLeft = () => Math.max(0, Math.ceil((Number(endsAt || 0) - Date.now()) / 1000));
  const [left, setLeft] = useState(getLeft);

  useEffect(() => {
    setLeft(getLeft());
    const timer = window.setInterval(() => setLeft(getLeft()), 250);
    return () => window.clearInterval(timer);
  }, [endsAt]);

  const urgent = left <= 10;
  const progress = Math.max(0, Math.min(1, left / Math.max(1, Number(duration) || 1)));
  const dashOffset = CIRCUMFERENCE * (1 - progress);

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full bg-violet-950/75 shadow-lg ring-1 ring-white/10 ${compact ? 'h-12 w-12' : 'h-14 w-14'} ${urgent ? 'text-red-400 motion-safe:animate-pulse' : 'text-amber-300'}`}
      role="timer"
      aria-label={messages.a11y.secondsRemaining(left)}
    >
      <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 40 40" aria-hidden="true">
        <circle cx="20" cy="20" r="16" fill="none" className="stroke-white/15" strokeWidth="3" />
        <circle
          cx="20"
          cy="20"
          r="16"
          fill="none"
          className="stroke-current transition-[stroke-dashoffset] duration-200 motion-reduce:transition-none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <span className={`${compact ? 'text-sm' : 'text-base'} relative font-display font-bold tabular-nums text-white`}>
        {left}
      </span>
    </span>
  );
}

export default memo(Timer);
