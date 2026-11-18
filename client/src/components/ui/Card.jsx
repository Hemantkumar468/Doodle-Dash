import { cx } from './utils';

export default function Card({ as: Component = 'section', children, className = '', ...props }) {
  return <Component className={cx('glass-panel', className)} {...props}>{children}</Component>;
}

export function Panel({
  as: Component = 'section',
  title,
  subtitle,
  icon,
  action,
  children,
  className = '',
  headerClassName = '',
  bodyClassName = '',
  ...props
}) {
  return (
    <Component className={cx('glass-panel flex min-h-0 min-w-0 flex-col', className)} {...props}>
      {(title || subtitle || icon || action) && (
        <header className={cx('flex min-w-0 shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2.5', headerClassName)}>
          {icon && <span className="shrink-0 text-violet-200" aria-hidden="true">{icon}</span>}
          <div className="min-w-0 flex-1">
            {title && <h2 className="panel-heading break-words">{title}</h2>}
            {subtitle && <p className="mt-0.5 break-words text-xs text-violet-300">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cx('min-h-0 min-w-0 flex-1 p-3', bodyClassName)}>{children}</div>
    </Component>
  );
}
