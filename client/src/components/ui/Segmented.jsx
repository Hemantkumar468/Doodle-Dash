import { cx } from './utils';

export default function Segmented({ label, options, value, onChange, disabled = false, className = '' }) {
  return (
    <fieldset className={cx('min-w-0', className)} disabled={disabled}>
      {label && <legend className="mb-1.5 block text-sm font-semibold leading-snug text-violet-100">{label}</legend>}
      <div className="grid min-w-0 gap-1 rounded-xl border border-white/10 bg-black/10 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((option) => {
          const item = typeof option === 'string' ? { value: option, label: option } : option;
          const selected = value === item.value;
          return (
            <button
              key={item.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange?.(item.value)}
              className={cx(
                'min-h-11 min-w-0 rounded-lg px-1.5 text-xs font-semibold leading-tight transition duration-175 sm:text-sm motion-reduce:transition-none',
                selected ? 'bg-brand-600 text-white shadow-button' : 'bg-transparent text-violet-200 hover:bg-white/[.08] hover:text-white',
              )}
            >
              <span className="block break-words">{item.label}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
