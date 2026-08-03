import {
  useState,
  useRef,
  useEffect,
  useCallback,
  createContext,
  useContext,
  type FC,
  type ReactNode,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';

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
  /** Restore focus to the trigger when the popover closes */
  restoreFocusOnClose?: boolean;
  /** Move focus into the content panel when the popover opens */
  focusOnOpen?: boolean;
  /** Additional classes for wrapper */
  className?: string;
}

interface PopoverTriggerProps {
  children?: ReactNode;
  className?: string;
  /** Render a native <button> (recommended) or a div with ARIA button role */
  as?: 'button' | 'div';
  /** ARIA role override (defaults to 'button' when as="div") */
  role?: string;
  /** aria-haspopup value (defaults to 'dialog') */
  ariaHaspopup?: 'dialog' | 'listbox' | 'menu' | 'grid' | 'tree' | 'true';
  /** Element id referenced from the trigger via aria-controls */
  ariaControls?: string;
  /** Accessible label */
  ariaLabel?: string;
  /** aria-invalid flag (form error state) */
  ariaInvalid?: boolean;
  /** Disabled state — blocks toggling and focus */
  disabled?: boolean;
  /** Native id for the trigger element */
  id?: string;
}

interface PopoverContentProps {
  children?: ReactNode;
  className?: string;
  /** ARIA role for the content panel (listbox, dialog, menu…) */
  role?: string;
  /** Element id (referenced from the trigger via aria-controls) */
  id?: string;
  /** Accessible label for the content panel */
  ariaLabel?: string;
}

/* ── Context ────────────────────────────────────────────────────────── */

interface PopoverContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
  side: PopoverSide;
  align: PopoverAlign;
  focusOnOpen: boolean;
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
  Trigger: FC<PopoverTriggerProps>;
  Content: FC<PopoverContentProps>;
} = ({
  children,
  side = 'bottom',
  align = 'center',
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  restoreFocusOnClose = true,
  focusOnOpen = false,
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

  const triggerRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

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

  // Capture the element that had focus before the popover opened so we can
  // restore it on close (Escape, selection, outside-click).
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
    }
  }, [open]);

  // Move focus into the content panel when opened with focusOnOpen
  useEffect(() => {
    if (!open || !focusOnOpen) return;
    const raf =
      typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame(() => contentRef.current?.focus())
        : window.setTimeout(() => contentRef.current?.focus(), 0);
    return () => {
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf);
      else window.clearTimeout(raf);
    };
  }, [open, focusOnOpen]);

  // Restore focus to the previously focused element (usually the trigger)
  // when the popover closes.
  useEffect(() => {
    if (open || !restoreFocusOnClose) return;
    const prev = previousFocusRef.current;
    if (prev && prev.isConnected) prev.focus();
    previousFocusRef.current = null;
  }, [open, restoreFocusOnClose]);

  // If the popover unmounts while still open, restore focus from the unmount
  // cleanup so focus is never silently dropped (e.g. page transitions).
  useEffect(() => {
    if (!open) return;
    return () => {
      if (!restoreFocusOnClose) return;
      const prev = previousFocusRef.current;
      if (prev && prev.isConnected) prev.focus();
    };
  }, [open, restoreFocusOnClose]);

  return (
    <PopoverContext.Provider
      value={{ open, setOpen, triggerRef, contentRef, side, align, focusOnOpen }}
    >
      <div className={`relative inline-block ${className}`}>
        {children}
      </div>
    </PopoverContext.Provider>
  );
};

/* ── Popover Trigger ───────────────────────────────────────────────── */

const PopoverTrigger: FC<PopoverTriggerProps> = ({
  children,
  className = '',
  as = 'div',
  role,
  ariaHaspopup = 'dialog',
  ariaControls,
  ariaLabel,
  ariaInvalid,
  disabled = false,
  id,
}) => {
  const { open, setOpen, triggerRef } = usePopoverContext();

  const handleClick = useCallback(() => {
    if (!disabled) setOpen(!open);
  }, [disabled, open, setOpen]);

  // Only toggle when the trigger itself is focused — key events from nested
  // controls (e.g. pill remove buttons) must not bubble into a toggle.
  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent) => {
      if (disabled || e.target !== e.currentTarget) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setOpen(!open);
      }
    },
    [disabled, open, setOpen],
  );

  const a11yProps = {
    'aria-haspopup': ariaHaspopup,
    'aria-expanded': open,
    'aria-controls': ariaControls,
    'aria-label': ariaLabel,
    'aria-invalid': ariaInvalid,
    'aria-disabled': disabled || undefined,
  };

  if (as === 'button') {
    return (
      <button
        ref={triggerRef as React.RefObject<HTMLButtonElement | null>}
        id={id}
        type="button"
        disabled={disabled}
        onClick={handleClick}
        className={className}
        {...a11yProps}
      >
        {children}
      </button>
    );
  }

  return (
    <div
      ref={triggerRef as React.RefObject<HTMLDivElement | null>}
      id={id}
      role={role ?? 'button'}
      tabIndex={disabled ? -1 : 0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={className}
      {...a11yProps}
    >
      {children}
    </div>
  );
};

/* ── Popover Content ───────────────────────────────────────────────── */

const PopoverContent: FC<PopoverContentProps> = ({
  children,
  className = '',
  role,
  id,
  ariaLabel,
}) => {
  const { open, contentRef, side, align, focusOnOpen } = usePopoverContext();

  if (!open) return null;

  return (
    <div
      ref={contentRef}
      id={id}
      role={role}
      aria-label={ariaLabel}
      tabIndex={focusOnOpen ? -1 : undefined}
      className={`
        absolute z-dropdown rounded-lg border border-neutral-200 bg-white shadow-lg
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
