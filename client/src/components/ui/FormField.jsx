import { forwardRef, useId } from 'react';
import { CircleAlert } from 'lucide-react';
import { messages } from '../../lib/messages';
import { cx } from './utils';

const FormField = forwardRef(function FormField({
  as: Control = 'input',
  id,
  label,
  helper,
  error,
  className = '',
  fieldClassName = '',
  children,
  ...props
}, ref) {
  const generatedId = useId();
  const fieldId = id || `field-${generatedId.replace(/:/g, '')}`;
  const helperId = helper ? `${fieldId}-help` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [helperId, errorId, props['aria-describedby']].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cx('min-w-0', className)}>
      <label htmlFor={fieldId} className="mb-1.5 block text-sm font-semibold leading-snug text-violet-100">{label}</label>
      {children || (
        <Control
          {...props}
          ref={ref}
          id={fieldId}
          className={cx('field', fieldClassName)}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
        />
      )}
      {helper && <p id={helperId} className="mt-1.5 break-words text-sm leading-snug text-violet-200">{helper}</p>}
      {error && (
        <p id={errorId} className="mt-1.5 flex min-w-0 items-start gap-1.5 break-words text-sm font-semibold leading-snug text-rose-300" role="alert">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span><span className="sr-only">{messages.a11y.errorIcon} </span>{error}</span>
        </p>
      )}
    </div>
  );
});

export default FormField;
