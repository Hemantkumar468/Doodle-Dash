import { cx } from './utils';

export default function EmptyState({ icon, title, hint, action, className = '' }) {
  return (
    <div className={cx('flex min-h-36 min-w-0 flex-col items-center justify-center px-4 py-5 text-center', className)} role="status">
      {icon && <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[.07] text-violet-200" aria-hidden="true">{icon}</span>}
      {title && <p className="break-words text-sm font-semibold text-white">{title}</p>}
      {hint && <p className="mt-1 max-w-xs break-words text-sm leading-relaxed text-violet-200">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
