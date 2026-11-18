import { useEffect, useRef, useState } from 'react';
import { CircleCheck, LoaderCircle, WifiOff } from 'lucide-react';
import { messages } from '../lib/messages';
import { socket } from '../lib/socket';
import { Button } from './ui';

export default function ConnectionBanner({ status, timedOut = false, onHome, onRetry }) {
  const previousStatus = useRef(status);
  const [backOnline, setBackOnline] = useState(false);

  useEffect(() => {
    if (status === 'connected' && ['disconnected', 'error'].includes(previousStatus.current)) {
      setBackOnline(true);
      const timer = window.setTimeout(() => setBackOnline(false), 5000);
      previousStatus.current = status;
      return () => window.clearTimeout(timer);
    }
    previousStatus.current = status;
    return undefined;
  }, [status]);

  if (status === 'connected' && !timedOut && !backOnline) return null;
  if (backOnline && status === 'connected' && !timedOut) {
    return (
      <aside className="fixed left-[max(.5rem,env(safe-area-inset-left))] right-[max(.5rem,env(safe-area-inset-right))] top-[max(.5rem,env(safe-area-inset-top))] z-50 mx-auto flex max-w-xl items-center gap-2 rounded-2xl border border-emerald-300/30 bg-emerald-950/90 p-3 font-bold text-emerald-100 shadow-2xl backdrop-blur-xl" role="status" aria-live="polite">
        <CircleCheck className="h-5 w-5 shrink-0 text-emerald-300" aria-hidden="true" />{messages.connection.backOnline}
      </aside>
    );
  }
  const failed = timedOut;

  return (
    <aside
      className={`fixed left-[max(.5rem,env(safe-area-inset-left))] right-[max(.5rem,env(safe-area-inset-right))] top-[max(.5rem,env(safe-area-inset-top))] z-50 mx-auto max-w-xl rounded-2xl border p-3 shadow-2xl backdrop-blur-xl ${failed ? 'border-red-300/30 bg-red-950/90 text-red-100' : 'border-amber-300/30 bg-slate-950/90 text-amber-100'}`}
      role={failed ? 'alert' : 'status'}
      aria-live="polite"
    >
      <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
        {failed ? <WifiOff className="mt-0.5 h-5 w-5 shrink-0 text-red-300" aria-hidden="true" /> : <LoaderCircle className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-amber-300 motion-reduce:animate-none" aria-hidden="true" />}
        <div className="min-w-0">
          <p className="break-words font-extrabold">{failed ? messages.connection.failedTitle : messages.connection.reconnecting}</p>
          <p className="mt-0.5 break-words text-sm leading-snug opacity-80">{failed ? messages.connection.failedText : messages.loading.usuallyQuick}</p>
        </div>
      </div>
      {failed && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button full className="!px-2" onClick={() => onRetry ? onRetry() : socket.connect()}>{messages.common.tryAgain}</Button>
          {onHome ? <Button full variant="secondary" className="!px-2" onClick={onHome}>{messages.common.goHome}</Button> : <span />}
        </div>
      )}
    </aside>
  );
}
