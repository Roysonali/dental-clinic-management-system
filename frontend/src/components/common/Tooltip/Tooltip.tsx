import { useState, useRef, useEffect, useCallback, type FC, type ReactNode } from 'react';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps {
  /** Tooltip trigger content */
  children: ReactNode;
  /** Tooltip text */
  content?: string;
  /** Position relative to trigger */
  position?: TooltipPosition;
  /** Show delay in ms */
  showDelay?: number;
  /** Hide delay in ms */
  hideDelay?: number;
  /** Disables tooltip */
  disabled?: boolean;
  /** Additional classes for the trigger wrapper */
  className?: string;
}

/* ── Position maps ──────────────────────────────────────────────────── */

const positionMap: Record<TooltipPosition, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

const arrowMap: Record<TooltipPosition, string> = {
  top: 'top-full left-1/2 -translate-x-1/2 border-l-4 border-r-4 border-t-4 border-transparent border-t-neutral-800',
  bottom: 'bottom-full left-1/2 -translate-x-1/2 border-l-4 border-r-4 border-b-4 border-transparent border-b-neutral-800',
  left: 'left-full top-1/2 -translate-y-1/2 border-t-4 border-b-4 border-l-4 border-transparent border-l-neutral-800',
  right: 'right-full top-1/2 -translate-y-1/2 border-t-4 border-b-4 border-r-4 border-transparent border-r-neutral-800',
};

/**
 * Tooltip — hover/focus tooltip with configurable position and delay.
 *
 * @example
 * ```tsx
 * <Tooltip content="Add new patient">
 *   <Button>+</Button>
 * </Tooltip>
 * ```
 */
export const Tooltip: FC<TooltipProps> = ({
  children,
  content,
  position = 'top',
  showDelay = 300,
  hideDelay = 150,
  disabled = false,
  className = '',
}) => {
  const [visible, setVisible] = useState(false);
  const showTimer = useRef<ReturnType<typeof setTimeout>>();
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      clearTimeout(showTimer.current);
      clearTimeout(hideTimer.current);
    };
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (disabled) return;
    clearTimeout(hideTimer.current);
    showTimer.current = setTimeout(() => setVisible(true), showDelay);
  }, [disabled, showDelay]);

  const handleMouseLeave = useCallback(() => {
    clearTimeout(showTimer.current);
    hideTimer.current = setTimeout(() => setVisible(false), hideDelay);
  }, [hideDelay]);

  const handleFocus = useCallback(() => {
    if (disabled) return;
    clearTimeout(hideTimer.current);
    setVisible(true);
  }, [disabled]);

  const handleBlur = useCallback(() => {
    setVisible(false);
  }, []);

  if (!content) return <>{children}</>;

  return (
    <div
      className={`relative inline-flex ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      {children}

      {visible && (
        <div
          className={`absolute z-tooltip ${positionMap[position]}`}
          role="tooltip"
        >
          <div className="whitespace-nowrap rounded-md bg-neutral-800 px-2.5 py-1.5 text-caption text-white shadow-sm">
            {content}
          </div>
          <div className={`absolute ${arrowMap[position]}`} aria-hidden="true" />
        </div>
      )}
    </div>
  );
};
