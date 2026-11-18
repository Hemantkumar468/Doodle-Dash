import { useId } from 'react';
import { X } from 'lucide-react';
import { messages } from '../../lib/messages';
import IconButton from './IconButton';
import useDialogFocus from './useDialogFocus';
import { cx } from './utils';

export default function Modal({ open = true, title, labelledBy, children, className = '', onClose }) {
  const generatedId = useId();
  const dialogRef = useDialogFocus(open, onClose);
  if (!open) return null;
  const titleId = labelledBy || (title ? `modal-${generatedId.replace(/:/g, '')}` : undefined);
  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-40 flex items-center justify-center bg-night-950/80 p-3 backdrop-blur-md sm:p-5"
      role="dialog"
      tabIndex={-1}
      aria-modal="true"
      aria-labelledby={titleId}
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}
    >
      <section className={cx('relative max-h-[min(90dvh,52rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-night-800/95 p-4 text-white shadow-glass backdrop-blur-xl motion-safe:animate-pop sm:p-6', className)}>
        {onClose && <IconButton label={messages.a11y.dismiss} variant="ghost" className="absolute right-2 top-2" onClick={onClose}><X className="h-5 w-5" aria-hidden="true" /></IconButton>}
        {title && <h2 id={titleId} className={cx('break-words text-center font-display text-2xl font-semibold', onClose && 'px-10')}>{title}</h2>}
        {children}
      </section>
    </div>
  );
}
