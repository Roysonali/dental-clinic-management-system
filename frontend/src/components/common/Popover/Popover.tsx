import { useState, useRef, useEffect, useCallback, createContext, useContext, type FC, type ReactNode } from 'react';

export type PopoverSide = 'bottom' | 'top' | 'left' | 'right';
export type PopoverAlign = 'start' | 'center' | 'end';

/* ── Types ────────────────────────────────────────────────────────── */

interface PopoverProps {
  /** Trigger element + optional Popover.Content */
  children?: ReactNode;
  /** Side relative to trigger */
  side?: PopoverSide;
  /** Alignment */
  align?: PopoverAlign;
  /** Controlled open */
  open?: boolean;
  /** Default open */
  defaultOpen?: boolean;
  /** Called when open changes */
  onOpenChange?: (open: boolean) => void;
  /** Additional classes for wrapper */
  className?: string;
}

interface PopoverContentProps {
  children?: ReactNode;
  className?: string;
}

/* ── Context ────────────────────────────────────────────────────────── */

interface PopoverContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLDivElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
  side: PopoverSide;
  align: PopoverAlign;
}

const PopoverContext = createContext<PopoverContextValue | null>(null);

function usePopoverContext(): PopoverContextValue {
  const ctx = useContext(PopoverContext);
  if (!ctx) throw new Error('Popover sub-components must be used within <Popover>.');
  return ctx;
}

/* ── Position maps ──────────────────────────────────────────────────── */

const sideMap: Record<PopoverSide, string> = {
  bottom: 'top-full mt-2',
  top: 'bottom-full mb-2',
  left: 'right-full mr-2',
  right: 'left-full ml-2',
};

const alignMap: Record<PopoverAlign, string> = {
  start: 'left-0',
  center: 'left-1/2 -translate-x-1/2',
  end: 'right-0',
};

/* ── Popover Container ─────────────────────────────────────────────── */

export const Popover: FC<PopoverProps> & {
  Trigger: FC<{ children?: ReactNode; className?: string }>;
  Content: FC<PopoverContentProps>;
} = ({
  children,
  side = 'bottom',
  align = 'center',
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  className = '',
}) => {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const setOpen = useCallback(
    (val: boolean) => {
      if (!isControlled) setInternalOpen(val);
      onOpenChange?.(val);
    },
    [isControlled, onOpenChange],
  );

  const triggerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  // Click outside + escape
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        contentRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open, setOpen]);

  return (
    <PopoverContext.Provider value={{ open, setOpen, triggerRef, contentRef, side, align }}>
      <div className={`relative inline-block ${className}`}>
        {children}
      </div>
    </PopoverContext.Provider>
  );
};

/* ── Popover Trigger ───────────────────────────────────────────────── */

const PopoverTrigger: FC<{ children?: ReactNode; className?: string }> = ({
  children,
  className = '',
}) => {
  const { open, setOpen, triggerRef } = usePopoverContext();

  return (
    <div
      ref={triggerRef}
      onClick={() => setOpen(!open)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(!open); } }}
      aria-haspopup="dialog"
      aria-expanded={open}
      className={className}
      role="button"
      tabIndex={0}
    >
      {children}
    </div>
  );
};

/* ── Popover Content ───────────────────────────────────────────────── */

const PopoverContent: FC<PopoverContentProps> = ({ children, className = '' }) => {
  const { open, contentRef, side, align } = usePopoverContext();

  if (!open) return null;

  return (
    <div
      ref={contentRef}
      className={`
        absolute z-dropdown min-w-[200px] rounded-lg border border-neutral-200 bg-white p-4 shadow-lg
        ${sideMap[side]}
        ${alignMap[align]}
        ${className}
      `}
    >
      {children}
    </div>
  );
};

/* ── Attach sub-components ─────────────────────────────────────────── */

Popover.Trigger = PopoverTrigger;
Popover.Content = PopoverContent;
