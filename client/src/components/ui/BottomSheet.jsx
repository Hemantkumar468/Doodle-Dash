import { useId } from 'react';
import { GripHorizontal, X } from 'lucide-react';
import { messages } from '../../lib/messages';
import IconButton from './IconButton';
import useDialogFocus from './useDialogFocus';
import { cx } from './utils';

export default function BottomSheet({ open = true, title, labelledBy, children, className = '', onClose }) {
  const generatedId = useId();
  const dialogRef = useDialogFocus(open, onClose);
  if (!open) return null;
  const titleId = labelledBy || (title ? `sheet-${generatedId.replace(/:/g, '')}` : undefined);
  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-40 flex items-end bg-night-950/80 p-2 pb-[max(.5rem,env(safe-area-inset-bottom))] backdrop-blur-md md:items-center md:justify-center md:p-5"
      role="dialog"
      tabIndex={-1}
      aria-modal="true"
      aria-labelledby={titleId}
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}
    >
      <section className={cx('relative max-h-[min(88dvh,46rem)] w-full min-w-0 overflow-y-auto rounded-t-2xl border border-white/10 bg-night-800/95 p-4 text-white shadow-glass backdrop-blur-xl motion-safe:animate-slide-up md:max-w-lg md:rounded-2xl md:p-6', className)}>
        <GripHorizontal className="mx-auto mb-3 h-5 w-10 text-violet-300 md:hidden" aria-hidden="true" />
        {onClose && <IconButton label={messages.a11y.dismiss} variant="ghost" size="sm" className="absolute right-2 top-2" onClick={onClose}><X className="h-5 w-5" aria-hidden="true" /></IconButton>}
        {title && <h2 id={titleId} className={cx('break-words text-center font-display text-2xl font-semibold text-white', onClose && 'px-10')}>{title}</h2>}
        {children}
      </section>
    </div>
  );
}
