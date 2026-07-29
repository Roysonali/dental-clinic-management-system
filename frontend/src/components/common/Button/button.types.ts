import type { ButtonHTMLAttributes, ReactNode } from 'react';

/* ── Variants ──────────────────────────────────────────────────────── */

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'
  | 'success'
  | 'link';

/* ── Sizes ─────────────────────────────────────────────────────────── */

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/* ── Props ─────────────────────────────────────────────────────────── */

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button visual style */
  variant?: ButtonVariant;
  /** Button size */
  size?: ButtonSize;
  /** Show loading spinner (disables button) */
  loading?: boolean;
  /** Icon displayed before the label */
  leftIcon?: ReactNode;
  /** Icon displayed after the label */
  rightIcon?: ReactNode;
  /** Display only an icon (square shape, no text) */
  iconOnly?: boolean;
  /** Stretch to full container width */
  fullWidth?: boolean;
}

/* ── IconButton Props (restricted subset) ──────────────────────────── */

export interface IconButtonProps
  extends Omit<ButtonProps, 'leftIcon' | 'rightIcon' | 'iconOnly' | 'children'> {
  /** The icon element to render */
  icon: ReactNode;
  /** Accessible label for screen readers (required) */
  'aria-label': string;
  /** Visual style */
  variant?: ButtonVariant;
  /** Button size */
  size?: ButtonSize;
}
