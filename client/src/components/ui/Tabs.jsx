import { cx } from './utils';
import { messages } from '../../lib/messages';

export default function Tabs({ tabs, value, onChange, label = messages.a11y.defaultTabs, className = '' }) {
  return (
    <div className={cx('grid min-w-0 gap-1 rounded-xl border border-white/10 bg-black/10 p-1', className)} style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }} role="tablist" aria-label={label}>
      {tabs.map((tab) => {
        const active = value === tab.value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange?.(tab.value)}
            className={cx('relative min-h-11 min-w-0 rounded-lg px-2 text-sm font-semibold transition duration-175 motion-reduce:transition-none', active ? 'bg-white/15 text-white shadow-sm' : 'text-violet-200 hover:bg-white/[.07] hover:text-white')}
          >
            <span className="break-words leading-tight">{tab.label}</span>
            {tab.unread && !active && <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-danger-400 ring-2 ring-night-900" aria-label={messages.a11y.unread} />}
          </button>
        );
      })}
    </div>
  );
}
