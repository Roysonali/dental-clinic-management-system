import { useEffect, useRef, useCallback, type FC, type ReactNode, type KeyboardEvent } from 'react';

/* ── Types ────────────────────────────────────────────────────────── */

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

interface ModalProps {
  /** Open state */
  open: boolean;
  /** Called when the modal should close (backdrop click, escape, X button) */
  onClose: () => void;
  /** Size preset */
  size?: ModalSize;
  /** Content */
  children?: ReactNode;
  /** Additional classes */
  className?: string;
}

interface ModalHeaderProps {
  children?: ReactNode;
  className?: string;
}

interface ModalBodyProps {
  children?: ReactNode;
  className?: string;
}

interface ModalFooterProps {
  children?: ReactNode;
  className?: string;
}

/* ── Size map ───────────────────────────────────────────────────────── */

const sizeMap: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[calc(100vw-2rem)] mx-4',
};

/* ── Focus trap helper ──────────────────────────────────────────────── */

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selectors = [
    'a[href]', 'button:not([disabled])', 'input:not([disabled])',
    'textarea:not([disabled])', 'select:not([disabled])', '[tabindex]:not([tabindex="-1"])',
  ];
  return Array.from(container.querySelectorAll<HTMLElement>(selectors.join(',')));
}

/* ── Modal Container ────────────────────────────────────────────────── */

export const Modal: FC<ModalProps> & {
  Header: FC<ModalHeaderProps>;
  Body: FC<ModalBodyProps>;
  Footer: FC<ModalFooterProps>;
} = ({ open, onClose, size = 'md', children, className = '' }) => {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Focus trap + escape + overflow hidden
  useEffect(() => {
    if (!open) return;

    previousActiveElement.current = document.activeElement as HTMLElement;
    document.body.style.overflow = 'hidden';

    // Auto-focus dialog
    const frame = requestAnimationFrame(() => dialogRef.current?.focus());

    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = '';
      previousActiveElement.current?.focus();
    };
  }, [open]);

  // Tab focus trap
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !dialogRef.current) return;
    const focusable = getFocusableElements(dialogRef.current);
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
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-4"
      role="presentation"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={`
          relative w-full ${sizeMap[size]} max-h-[85vh] overflow-y-auto
          rounded-xl bg-white shadow-xl
          focus-visible:outline-none
          ${className}
        `}
      >
        {children}
      </div>
    </div>
  );
};

/* ── Modal Header ──────────────────────────────────────────────────── */

const ModalHeader: FC<ModalHeaderProps> = ({ children, className = '' }) => (
  <div className={`flex items-start justify-between gap-4 border-b border-neutral-200 px-6 py-4 ${className}`}>
    <div className="min-w-0 flex-1">{children}</div>
  </div>
);

/* ── Modal Body ────────────────────────────────────────────────────── */

const ModalBody: FC<ModalBodyProps> = ({ children, className = '' }) => (
  <div className={`px-6 py-4 ${className}`}>{children}</div>
);

/* ── Modal Footer ──────────────────────────────────────────────────── */

const ModalFooter: FC<ModalFooterProps> = ({ children, className = '' }) => (
  <div className={`flex items-center justify-end gap-3 border-t border-neutral-200 px-6 py-4 ${className}`}>
    {children}
  </div>
);

/* ── Attach sub-components ─────────────────────────────────────────── */

Modal.Header = ModalHeader;
Modal.Body = ModalBody;
Modal.Footer = ModalFooter;
