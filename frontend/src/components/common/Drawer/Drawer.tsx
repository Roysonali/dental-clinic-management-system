import { useEffect, useRef, useCallback, type FC, type ReactNode, type KeyboardEvent } from 'react';

/* ── Types ────────────────────────────────────────────────────────── */

export type DrawerPosition = 'left' | 'right';
export type DrawerSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

interface DrawerProps {
  /** Open state */
  open: boolean;
  /** Called when the drawer should close */
  onClose: () => void;
  /** Slide-in side */
  position?: DrawerPosition;
  /** Width preset */
  size?: DrawerSize;
  /** Content */
  children?: ReactNode;
  /** Accessible name for the dialog */
  ariaLabel?: string;
  /** Additional classes */
  className?: string;
}

interface DrawerHeaderProps {
  children?: ReactNode;
  className?: string;
}

interface DrawerBodyProps {
  children?: ReactNode;
  className?: string;
}

interface DrawerFooterProps {
  children?: ReactNode;
  className?: string;
}

/* ── Size maps ───────────────────────────────────────────────────────── */

const sizeMap: Record<DrawerSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-[calc(100vw-2rem)]',
};

const positionMap: Record<DrawerPosition, string> = {
  left: 'left-0 top-0 h-full',
  right: 'right-0 top-0 h-full',
};

const slideMap: Record<DrawerPosition, string> = {
  left: 'slide-in-from-left',
  right: 'slide-in-from-right',
};

/* ── Focus trap helper ──────────────────────────────────────────────── */

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selectors = [
    'a[href]', 'button:not([disabled])', 'input:not([disabled])',
    'textarea:not([disabled])', 'select:not([disabled])', '[tabindex]:not([tabindex="-1"])',
  ];
  return Array.from(container.querySelectorAll<HTMLElement>(selectors.join(',')));
}

/* ── Drawer Container ──────────────────────────────────────────────── */

export const Drawer: FC<DrawerProps> & {
  Header: FC<DrawerHeaderProps>;
  Body: FC<DrawerBodyProps>;
  Footer: FC<DrawerFooterProps>;
} = ({ open, onClose, position = 'right', size = 'md', children, ariaLabel, className = '' }) => {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Escape + overflow + focus save/restore + auto-focus panel
  useEffect(() => {
    if (!open) return;
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Move focus to the dialog panel
    requestAnimationFrame(() => {
      panelRef.current?.focus();
    });

    const handleEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
      previousActiveElement.current?.focus();
    };
  }, [open, onClose]);

  // Tab focus trap
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !panelRef.current) return;
    const focusable = getFocusableElements(panelRef.current);
    if (focusable.length === 0) { e.preventDefault(); return; }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-drawer" role="presentation">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        onKeyDown={handleKeyDown}
        className={`
          absolute flex flex-col bg-white shadow-xl
          w-full ${sizeMap[size]} h-full
          ${positionMap[position]}
          animate-in ${slideMap[position]} duration-300
          focus-visible:outline-none
          ${className}
        `}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  );
};

/* ── Drawer Header ────────────────────────────────────────────────── */

const DrawerHeader: FC<DrawerHeaderProps> = ({ children, className = '' }) => (
  <div className={`flex items-start justify-between gap-4 border-b border-neutral-200 px-5 py-4 ${className}`}>
    <div className="min-w-0 flex-1">{children}</div>
  </div>
);

/* ── Drawer Body ──────────────────────────────────────────────────── */

const DrawerBody: FC<DrawerBodyProps> = ({ children, className = '' }) => (
  <div className={`flex-1 overflow-y-auto px-5 py-4 ${className}`}>{children}</div>
);

/* ── Drawer Footer ────────────────────────────────────────────────── */

const DrawerFooter: FC<DrawerFooterProps> = ({ children, className = '' }) => (
  <div className={`flex items-center justify-end gap-3 border-t border-neutral-200 px-5 py-4 ${className}`}>
    {children}
  </div>
);

/* ── Attach sub-components ─────────────────────────────────────────── */

Drawer.Header = DrawerHeader;
Drawer.Body = DrawerBody;
Drawer.Footer = DrawerFooter;
