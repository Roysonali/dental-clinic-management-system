import type { FC } from 'react';
import type { CardProps, CardVariant, CardSize, CardHeaderProps, CardBodyProps, CardFooterProps } from './card.types';
import { Skeleton } from '../Skeleton/Skeleton';

/* ── Style Maps ──────────────────────────────────────────────────────── */

const variantStyles: Record<CardVariant, string> = {
  default: 'bg-white border border-neutral-200',
  outlined: 'bg-white border-2 border-neutral-200',
  elevated: 'bg-white border border-neutral-100 shadow-md',
  filled: 'bg-neutral-50 border border-neutral-200',
  interactive: 'bg-white border border-neutral-200 cursor-pointer hover:border-primary-300 hover:shadow-sm active:border-primary-400 transition-all duration-150',
};

const sizeStyles: Record<CardSize, string> = {
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-6',
};

/* ── Card Container ─────────────────────────────────────────────────-- */

export const Card: FC<CardProps> & {
  Header: FC<CardHeaderProps>;
  Body: FC<CardBodyProps>;
  Footer: FC<CardFooterProps>;
} = ({ variant = 'default', size = 'md', loading = false, className = '', children }) => {
  if (loading) {
    return (
      <div className={`rounded-xl ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}>
        <Skeleton variant="card" />
      </div>
    );
  }

  return (
    <div className={`rounded-xl ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}>
      {children}
    </div>
  );
};

/* ── Card Header ─────────────────────────────────────────────────────── */

const CardHeader: FC<CardHeaderProps> = ({ title, subtitle, icon, actions, className = '' }) => {
  if (!title && !subtitle && !icon && !actions) return null;

  return (
    <div className={`mb-4 flex items-start justify-between gap-4 ${className}`}>
      <div className="flex items-start gap-3 min-w-0">
        {icon && (
          <div className="mt-0.5 shrink-0">{icon}</div>
        )}
        <div className="min-w-0">
          {title && (
            <h3 className="text-h4 font-semibold text-neutral-900 truncate">{title}</h3>
          )}
          {subtitle && (
            <p className="mt-0.5 text-body-sm text-neutral-500">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
};

/* ── Card Body ───────────────────────────────────────────────────────── */

const CardBody: FC<CardBodyProps> = ({ children, className = '' }) => {
  if (!children) return null;
  return <div className={className}>{children}</div>;
};

/* ── Card Footer ─────────────────────────────────────────────────────── */

const CardFooter: FC<CardFooterProps> = ({ children, className = '' }) => {
  if (!children) return null;
  return (
    <div className={`mt-4 border-t border-neutral-100 pt-4 ${className}`}>
      {children}
    </div>
  );
};

/* ── Attach sub-components ───────────────────────────────────────────── */

Card.Header = CardHeader;
Card.Body = CardBody;
Card.Footer = CardFooter;
