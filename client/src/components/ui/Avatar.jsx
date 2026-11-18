import { Check, Crown, Pencil } from 'lucide-react';
import { cx } from './utils';

const sizes = {
  sm: { shell: 'h-9 w-9 text-lg', badge: 'h-4 w-4', icon: 'h-2.5 w-2.5' },
  md: { shell: 'h-11 w-11 text-xl', badge: 'h-5 w-5', icon: 'h-3 w-3' },
  lg: { shell: 'h-14 w-14 text-2xl', badge: 'h-5 w-5', icon: 'h-3 w-3' },
};

export default function Avatar({
  avatar,
  name,
  size = 'md',
  isHost = false,
  isDrawer = false,
  hasGuessed = false,
  isConnected = true,
  className = '',
}) {
  const style = sizes[size] || sizes.md;
  const fallback = String(name || '?').trim().slice(0, 1).toUpperCase();
  return (
    <span className={cx('relative inline-flex shrink-0', className)}>
      <span
        className={cx(
          'inline-flex items-center justify-center rounded-full border border-white/15 bg-white/10 font-display font-semibold text-white shadow-sm',
          style.shell,
          !isConnected && 'grayscale opacity-55',
        )}
        aria-hidden="true"
      >
        {avatar || fallback}
      </span>
      {isHost && (
        <span className={cx('absolute -right-1 -top-1 flex items-center justify-center rounded-full border border-night-900 bg-accent-400 text-night-950 shadow', style.badge)}>
          <Crown className={style.icon} aria-hidden="true" />
        </span>
      )}
      {isDrawer && (
        <span className={cx('absolute -bottom-1 -right-1 flex items-center justify-center rounded-full border border-night-900 bg-brand-500 text-white shadow', style.badge)}>
          <Pencil className={style.icon} aria-hidden="true" />
        </span>
      )}
      {hasGuessed && !isDrawer && (
        <span className={cx('absolute -bottom-1 -right-1 flex items-center justify-center rounded-full border border-night-900 bg-success-500 text-white shadow', style.badge)}>
          <Check className={style.icon} aria-hidden="true" />
        </span>
      )}
    </span>
  );
}
