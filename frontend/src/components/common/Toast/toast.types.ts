import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export type ToastVariant = 'info' | 'success' | 'warning' | 'danger';

export type ToastPosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'top-center'
  | 'bottom-center';

export interface Toast {
  /** Unique identifier */
  id: string;
  /** Visual variant */
  variant: ToastVariant;
  /** Title text */
  title?: string;
  /** Description text */
  description?: string;
  /** Custom icon override */
  icon?: LucideIcon;
  /** Duration in ms before auto-dismiss (0 = persistent) */
  duration?: number;
  /** Optional action element */
  action?: ReactNode;
  /** Whether toast is entering/exiting */
  exiting?: boolean;
}

export interface ToastContainerProps {
  /** Array of active toasts */
  toasts: Toast[];
  /** Position on screen */
  position?: ToastPosition;
  /** Called when a toast is dismissed */
  onDismiss: (id: string) => void;
}
