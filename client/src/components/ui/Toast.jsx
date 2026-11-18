import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { messages } from '../../lib/messages';
import IconButton from './IconButton';
import { cx } from './utils';

const styles = {
  info: 'border-info-400/35 bg-info-900/90 text-sky-50',
  success: 'border-success-400/35 bg-success-900/90 text-emerald-50',
  warning: 'border-accent-400/35 bg-amber-950/90 text-amber-50',
  error: 'border-danger-400/35 bg-danger-900/90 text-rose-50',
};

export default function Toast({ children, tone = 'info', className = '', role, duration = 5000, onDismiss, action }) {
  const [visible, setVisible] = useState(true);
  const dismissRef = useRef(onDismiss);

  useEffect(() => { dismissRef.current = onDismiss; }, [onDismiss]);

  useEffect(() => {
    setVisible(true);
    if (!duration) return undefined;
    const timer = window.setTimeout(() => {
      setVisible(false);
      dismissRef.current?.();
    }, Math.min(6000, Math.max(4000, duration)));
    return () => window.clearTimeout(timer);
  }, [children, duration]);

  if (!visible) return null;
  const dismiss = () => { setVisible(false); dismissRef.current?.(); };
  return (
    <div className={cx('flex min-w-0 items-start gap-2 break-words rounded-xl border px-3 py-2.5 text-sm font-semibold leading-snug shadow-glass backdrop-blur-xl motion-safe:animate-pop', styles[tone] || styles.info, className)} role={role || (tone === 'error' ? 'alert' : 'status')}>
      <div className="min-w-0 flex-1 py-1">{children}</div>
      {action}
      {onDismiss && <IconButton label={messages.a11y.dismiss} variant="ghost" size="sm" className="!text-current" onClick={dismiss}><X className="h-4 w-4" aria-hidden="true" /></IconButton>}
    </div>
  );
}

export function ToastStack({ items = [], className = '' }) {
  return (
    <div className={cx('grid gap-2', className)} aria-live="polite">
      {items.slice(-3).map((item) => <Toast key={item.id} {...item}>{item.message}</Toast>)}
    </div>
  );
}
