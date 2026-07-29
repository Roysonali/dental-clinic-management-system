import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export type BadgeVariant =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'outline';

export type BadgeSize = 'xs' | 'sm' | 'md';

export interface BadgeProps {
  /** Badge text or content */
  children: ReactNode;
  /** Visual variant */
  variant?: BadgeVariant;
  /** Size */
  size?: BadgeSize;
  /** Optional leading icon */
  icon?: LucideIcon;
  /** Show as a small colored dot only (no text) */
  dot?: boolean;
  /** Removable (shows X button) */
  removable?: boolean;
  /** Called when removed */
  onRemove?: () => void;
  /** Additional classes */
  className?: string;
}
