import type { FC } from 'react';
import type { ToastContainerProps, ToastPosition } from './toast.types';
import { ToastItem } from './Toast';

/* ── Position maps ──────────────────────────────────────────────────── */

const positionClasses: Record<ToastPosition, string> = {
  'top-left': 'top-4 left-4',
  'top-right': 'top-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'bottom-right': 'bottom-4 right-4',
  'top-center': 'top-4 left-1/2 -translate-x-1/2',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
};

const stackClass: Record<string, string> = {
  top: 'flex-col',
  bottom: 'flex-col-reverse',
};

/**
 * ToastContainer — renders a stack of toasts at a specified screen position.
 *
 * This is an infrastructure component. Global toast state management
 * (add/remove/auto-dismiss) will be added in a later phase.
 *
 * @example
 * ```tsx
 * <ToastContainer toasts={toasts} position="top-right" onDismiss={handleDismiss} />
 * ```
 */
export const ToastContainer: FC<ToastContainerProps> = ({
  toasts,
  position = 'top-right',
  onDismiss,
}) => {
  if (toasts.length === 0) return null;

  const verticalDir = position.startsWith('top') ? 'top' : 'bottom';

  return (
    <div
      className={`fixed z-notification flex w-80 max-w-[calc(100vw-2rem)] gap-2 ${positionClasses[position]}`}
      aria-label="Notifications"
      role="region"
    >
      <div className={`flex ${stackClass[verticalDir]} w-full gap-2`}>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </div>
    </div>
  );
};
