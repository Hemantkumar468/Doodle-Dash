import { useId } from 'react';
import { cx } from './utils';

const positions = {
  top: 'bottom-[calc(100%+.5rem)] left-1/2 -translate-x-1/2',
  bottom: 'top-[calc(100%+.5rem)] left-1/2 -translate-x-1/2',
  left: 'right-[calc(100%+.5rem)] top-1/2 -translate-y-1/2',
  right: 'left-[calc(100%+.5rem)] top-1/2 -translate-y-1/2',
};

export default function Tooltip({ content, children, side = 'top', className = '' }) {
  const id = useId();
  if (!content) return children;
  return (
    <span className={cx('group/tooltip relative inline-flex', className)} aria-describedby={id}>
      {children}
      <span
        id={id}
        role="tooltip"
        className={cx('pointer-events-none absolute z-50 hidden w-max max-w-56 rounded-lg border border-white/10 bg-night-950/95 px-2.5 py-1.5 text-center text-xs font-medium leading-snug text-white opacity-0 shadow-lg transition duration-175 group-hover/tooltip:block group-hover/tooltip:opacity-100 group-focus-within/tooltip:block group-focus-within/tooltip:opacity-100 motion-reduce:transition-none', positions[side] || positions.top)}
      >
        {content}
      </span>
    </span>
  );
}
