import { Minus, Plus } from 'lucide-react';
import IconButton from './IconButton';
import { messages } from '../../lib/messages';
import { cx } from './utils';

export default function Stepper({
  label,
  unit,
  value,
  min,
  max,
  step = 1,
  disabled = false,
  onChange,
  error,
  className = '',
}) {
  return (
    <div className={cx('min-w-0 rounded-xl border border-white/10 bg-white/[.05] p-3', className)}>
      <p className="mb-2 text-sm font-semibold text-violet-100">{label}</p>
      <div className="flex min-w-0 items-center justify-between gap-2">
        <IconButton
          label={messages.a11y.decrease(label)}
          disabled={disabled || value <= min}
          onClick={() => onChange?.(Math.max(min, value - step))}
          variant="ghost"
        >
          <Minus className="h-4 w-4" aria-hidden="true" />
        </IconButton>
        <span className="min-w-[4.5rem] shrink-0 text-center whitespace-nowrap tabular-nums">
          <span className="block text-xl font-bold leading-none text-white">{value}</span>
          {unit && <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wide text-violet-300">{unit}</span>}
        </span>
        <IconButton
          label={messages.a11y.increase(label)}
          disabled={disabled || value >= max}
          onClick={() => onChange?.(Math.min(max, value + step))}
          variant="ghost"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </IconButton>
      </div>
      {error && <p className="mt-2 text-sm font-semibold leading-snug text-rose-300" role="alert">{error}</p>}
    </div>
  );
}
