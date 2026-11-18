import { forwardRef } from 'react';
import { LoaderCircle } from 'lucide-react';
import { cx } from './utils';

const variants = {
  secondary: 'border-white/15 bg-white/[.08] text-white hover:bg-white/15',
  ghost: 'border-transparent bg-transparent text-violet-100 hover:border-white/10 hover:bg-white/10 hover:text-white',
  danger: 'border-danger-400/30 bg-danger-500/10 text-danger-400 hover:bg-danger-500/20',
  primary: 'border-brand-400/40 bg-brand-600 text-white hover:bg-brand-500',
};

const sizes = { sm: 'h-11 w-11 p-2', md: 'h-11 w-11 p-2.5', lg: 'h-12 w-12 p-3' };

const IconButton = forwardRef(function IconButton(
  { label, variant = 'secondary', size = 'md', loading = false, className = '', children, type = 'button', disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border transition duration-175 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 motion-reduce:transition-none',
        variants[variant] || variants.secondary,
        sizes[size] || sizes.md,
        className,
      )}
      {...props}
    >
      {loading ? <LoaderCircle className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : children}
    </button>
  );
});

export default IconButton;
