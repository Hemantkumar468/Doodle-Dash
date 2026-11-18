import { cx } from './utils';

export default function Toggle({ checked, onChange, label, description, disabled = false, className = '' }) {
  return (
    <label className={cx('flex min-h-11 min-w-0 items-center justify-between gap-3', disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer', className)}>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-violet-100">{label}</span>
        {description && <span className="mt-0.5 block break-words text-sm leading-snug text-violet-200">{description}</span>}
      </span>
      <span className="relative inline-flex min-h-11 min-w-14 shrink-0 items-center justify-center">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange?.(event.target.checked)}
        />
        <span className="h-7 w-12 rounded-full border border-white/15 bg-white/10 transition duration-175 peer-checked:border-brand-400/50 peer-checked:bg-brand-600 peer-focus-visible:ring-2 peer-focus-visible:ring-accent-400 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-night-900 peer-disabled:opacity-60 motion-reduce:transition-none" />
        <span className="pointer-events-none absolute left-2.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-175 peer-checked:translate-x-5 motion-reduce:transition-none" />
      </span>
    </label>
  );
}
