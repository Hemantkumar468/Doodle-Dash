import { forwardRef } from 'react';
import { LoaderCircle } from 'lucide-react';
import { cx } from './utils';

const variants = {
  primary: 'border-brand-400/40 bg-brand-600 text-white shadow-button hover:bg-brand-500',
  secondary: 'border-white/15 bg-white/10 text-white hover:bg-white/15',
  danger: 'border-danger-400/40 bg-danger-500 text-white hover:bg-rose-500',
  ghost: 'border-transparent bg-transparent text-violet-100 hover:border-white/10 hover:bg-white/10 hover:text-white',
};

const sizes = {
  sm: 'min-h-11 px-3 py-2 text-sm',
  md: 'min-h-11 px-4 py-2.5 text-sm',
  lg: 'min-h-12 px-5 py-3 text-base',
};

const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', full = false, loading = false, className = '', type = 'button', children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex min-w-11 items-center justify-center gap-2 rounded-xl border text-center font-bold leading-tight transition duration-175 active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100 motion-reduce:transition-none',
        variants[variant] || variants.primary,
        sizes[size] || sizes.md,
        full && 'w-full',
        className,
      )}
      {...props}
    >
      {loading && <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
      {children}
    </button>
  );
});

export default Button;
