import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export type AlertVariant = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

export interface AlertProps {
  /** Visual variant */
  variant?: AlertVariant;
  /** Title text (bold) */
  title?: string;
  /** Description/body text */
  description?: string;
  /** Custom icon override. If omitted, a default icon is used per variant. */
  icon?: LucideIcon;
  /** Show dismiss (X) button */
  dismissible?: boolean;
  /** Optional action buttons rendered at the bottom */
  actions?: ReactNode;
  /** Stretch to full container width */
  fullWidth?: boolean;
  /** Additional classes */
  className?: string;
  /** Called when dismissed */
  onDismiss?: () => void;
}
