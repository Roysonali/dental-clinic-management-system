import type { ReactNode } from 'react';

export type CardVariant = 'default' | 'outlined' | 'elevated' | 'filled' | 'interactive';
export type CardSize = 'sm' | 'md' | 'lg';

export interface CardProps {
  /** Visual variant */
  variant?: CardVariant;
  /** Size preset (controls padding) */
  size?: CardSize;
  /** Show loading skeleton placeholder */
  loading?: boolean;
  /** Additional classes */
  className?: string;
  /** Card content */
  children?: ReactNode;
}

export interface CardHeaderProps {
  /** Title text */
  title?: string;
  /** Subtitle text */
  subtitle?: string;
  /** Icon shown before title */
  icon?: ReactNode;
  /** Actions rendered at the right of the header */
  actions?: ReactNode;
  /** Additional classes */
  className?: string;
}

export interface CardBodyProps {
  children?: ReactNode;
  className?: string;
}

export interface CardFooterProps {
  children?: ReactNode;
  className?: string;
}
