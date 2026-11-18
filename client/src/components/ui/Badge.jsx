import { cx } from './utils';

const tones = {
  neutral: 'border-white/10 bg-white/10 text-violet-100',
  primary: 'border-brand-400/25 bg-brand-500/15 text-violet-100',
  accent: 'border-accent-400/30 bg-accent-400/15 text-amber-200',
  success: 'border-success-400/30 bg-success-400/15 text-emerald-200',
  danger: 'border-danger-400/30 bg-danger-400/15 text-rose-200',
  info: 'border-info-400/30 bg-info-400/15 text-sky-200',
};

export default function Badge({ as: Component = 'span', tone = 'neutral', icon, children, className = '', ...props }) {
  return (
    <Component className={cx('inline-flex min-h-7 min-w-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold leading-tight', tones[tone] || tones.neutral, className)} {...props}>
      {icon}
      <span className="min-w-0">{children}</span>
    </Component>
  );
}
