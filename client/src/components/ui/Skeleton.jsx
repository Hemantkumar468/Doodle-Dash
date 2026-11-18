import { cx } from './utils';

export default function Skeleton({ className = '', ...props }) {
  return (
    <span
      className={cx('relative block overflow-hidden rounded-lg bg-white/[.07] before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent motion-safe:before:animate-shimmer', className)}
      aria-hidden="true"
      {...props}
    />
  );
}
