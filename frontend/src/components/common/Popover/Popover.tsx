import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  createContext,
  useContext,
  type FC,
  type ReactNode,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { useOverlayLayer } from '../Overlay/OverlayLayerContext';

export type PopoverSide = 'bottom' | 'top' | 'left' | 'right';
export type PopoverAlign = 'start' | 'center' | 'end';
export type PopoverZIndex =
  | 'z-tooltip'
  | 'z-dropdown'
  | 'z-datepicker'
  | 'z-drawer'
  | 'z-modal'
  | 'z-notification'
  | 'z-overlay';

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
  /** Gap (px) between the trigger and the content */
  offset?: number;
  /** Z-index layer token applied to the floating content */
  zIndex?: PopoverZIndex;
  /**
   * Override the portal target. Defaults to the nearest overlay layer
   * (Drawer/Modal) root, falling back to `document.body`.
   */
  portalContainer?: HTMLElement | null;
  /** Additional classes for the trigger wrapper */
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
  offset: number;
  zIndex: PopoverZIndex;
  portalContainer: HTMLElement | null;
  focusOnOpen: boolean;
}

const PopoverContext = createContext<PopoverContextValue | null>(null);

function usePopoverContext(): PopoverContextValue {
  const ctx = useContext(PopoverContext);
  if (!ctx) throw new Error('Popover sub-components must be used within <Popover>.');
  return ctx;
}

/* ── Positioning ────────────────────────────────────────────────────── */

interface PopoverPosition {
  top: number;
  left: number;
  width?: number;
  ready: boolean;
}

const EDGE_MARGIN = 8;

/**
 * Compute fixed-viewport coordinates for the content relative to the
 * trigger. Flips to the opposite side when there is not enough space and
 * clamps the popover inside the viewport, so it never renders off-screen
 * or under another control when the space available is insufficient.
 */
function computePosition(opts: {
  trigger: HTMLElement;
  content: HTMLElement;
  side: PopoverSide;
  align: PopoverAlign;
  offset: number;
  contentClassName: string;
}): PopoverPosition {
  const { trigger, content, side, align, offset, contentClassName } = opts;
  const triggerRect = trigger.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const matchTriggerWidth = contentClassName.split(/\s+/).includes('w-full');
  const contentWidth = matchTriggerWidth
    ? Math.min(triggerRect.width, vw - EDGE_MARGIN * 2)
    : undefined;
  if (matchTriggerWidth && contentWidth !== undefined) {
    content.style.width = `${contentWidth}px`;
  }

  const contentRect = content.getBoundingClientRect();
  const cw = contentWidth ?? contentRect.width;
  const ch = contentRect.height;

  let top: number;
  let left: number;

  if (side === 'bottom' || side === 'top') {
    if (align === 'start') left = triggerRect.left;
    else if (align === 'center') left = triggerRect.left + (triggerRect.width - cw) / 2;
    else left = triggerRect.right - cw;

    const topForBottom = triggerRect.bottom + offset;
    const topForTop = triggerRect.top - ch - offset;
    const bottomFits = topForBottom + ch <= vh - EDGE_MARGIN;
    const topFits = topForTop >= EDGE_MARGIN;

    if (side === 'bottom') {
      top = bottomFits ? topForBottom : topFits ? topForTop : topForBottom;
    } else {
      top = topFits ? topForTop : bottomFits ? topForBottom : topForTop;
    }

    if (cw > vw - EDGE_MARGIN * 2) {
      left = EDGE_MARGIN;
    } else if (left < EDGE_MARGIN) {
      left = EDGE_MARGIN;
    } else if (left + cw > vw - EDGE_MARGIN) {
      left = Math.max(EDGE_MARGIN, vw - EDGE_MARGIN - cw);
    }
  } else {
    if (align === 'start') top = triggerRect.top;
    else if (align === 'center') top = triggerRect.top + (triggerRect.height - ch) / 2;
    else top = triggerRect.bottom - ch;

    const leftForRight = triggerRect.right + offset;
    const leftForLeft = triggerRect.left - cw - offset;
    const rightFits = leftForRight + cw <= vw - EDGE_MARGIN;
    const leftFits = leftForLeft >= EDGE_MARGIN;

    if (side === 'right') {
      left = rightFits ? leftForRight : leftFits ? leftForLeft : leftForRight;
    } else {
      left = leftFits ? leftForLeft : rightFits ? leftForRight : leftForLeft;
    }

    if (top < EDGE_MARGIN) {
      top = EDGE_MARGIN;
    } else if (top + ch > vh - EDGE_MARGIN) {
      top = Math.max(EDGE_MARGIN, vh - EDGE_MARGIN - ch);
    }
  }

  return { top, left, width: contentWidth, ready: true };
}

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
  offset = 8,
  zIndex = 'z-dropdown',
  portalContainer,
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
      value={{
        open,
        setOpen,
        triggerRef,
        contentRef,
        side,
        align,
        offset,
        zIndex,
        portalContainer: portalContainer ?? null,
        focusOnOpen,
      }}
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
  const { open, contentRef, triggerRef, side, align, offset, zIndex, portalContainer, focusOnOpen } =
    usePopoverContext();
  const overlayLayer = useOverlayLayer();

  const [pos, setPos] = useState<PopoverPosition>({ top: 0, left: 0, ready: false });

  const portalTarget = portalContainer ?? overlayLayer?.containerRef.current ?? document.body;

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const content = contentRef.current;
    if (!trigger || !content) return;
    setPos(computePosition({ trigger, content, side, align, offset, contentClassName: className }));
  }, [triggerRef, contentRef, side, align, offset, className]);

  // Position synchronously before paint so there is never a visible jump.
  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

  // Reposition on any scroll (capture catches nested scroll containers such
  // as a Drawer Body) and on window resize / device orientation change.
  useEffect(() => {
    if (!open) return;
    let raf: number | null = null;
    const reposition = () => {
      if (raf !== null) return;
      raf = window.requestAnimationFrame(() => {
        raf = null;
        updatePosition();
      });
    };
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
      if (raf !== null) window.cancelAnimationFrame(raf);
    };
  }, [open, updatePosition]);

  // Reposition when the content itself resizes (e.g. DatePicker switching
  // between the day grid and the month/year grids).
  useEffect(() => {
    if (!open || typeof ResizeObserver === 'undefined') return;
    const content = contentRef.current;
    if (!content) return;
    const observer = new ResizeObserver(() => updatePosition());
    observer.observe(content);
    return () => observer.disconnect();
  }, [open, updatePosition, contentRef]);

  if (!open) return null;

  const contentElement = (
    <div
      ref={contentRef}
      id={id}
      role={role}
      aria-label={ariaLabel}
      tabIndex={focusOnOpen ? -1 : undefined}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        width: pos.width,
        visibility: pos.ready ? 'visible' : 'hidden',
      }}
      className={`
        ${zIndex} rounded-lg border border-neutral-200 bg-white shadow-lg
        ${className}
      `}
    >
      {children}
    </div>
  );

  return createPortal(contentElement, portalTarget);
};

/* ── Attach sub-components ─────────────────────────────────────────── */

Popover.Trigger = PopoverTrigger;
Popover.Content = PopoverContent;
