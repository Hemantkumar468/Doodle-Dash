import { LoaderCircle } from 'lucide-react';
import { cx } from './utils';

export default function Spinner({ label, size = 'md', className = '' }) {
  const sizes = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-10 w-10' };
  return (
    <span className={cx('inline-flex items-center justify-center text-violet-200', className)} role={label ? 'status' : undefined} aria-label={label} aria-hidden={label ? undefined : 'true'}>
      <LoaderCircle className={cx('animate-spin motion-reduce:animate-none', sizes[size] || sizes.md)} aria-hidden="true" />
    </span>
  );
}
