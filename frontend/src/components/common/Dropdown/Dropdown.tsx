import {
  useState, useRef, useEffect, useCallback,
  cloneElement, isValidElement,
  type FC, type ReactNode,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import type { LucideIcon } from 'lucide-react';
import { Icon } from '../Icon/Icon';

/* ── Types ────────────────────────────────────────────────────────── */

interface DropdownProps {
  /** Controlled open state */
  open?: boolean;
  /** Default open state */
  defaultOpen?: boolean;
  /** Called when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Dropdown content (Dropdown.Trigger + Dropdown.Content) */
  children?: ReactNode;
  /** Additional classes */
  className?: string;
}

interface DropdownTriggerProps {
  children?: ReactNode;
  className?: string;
  /**
   * Render the child element as the trigger instead of wrapping it in a
   * `<button>`. Use this when the trigger is already an interactive element
   * (e.g. an IconButton) so the DOM never contains a `<button>` inside a
   * `<button>`. The child must accept a ref and button-related props
   * (`onClick`, `onKeyDown`, `type`, `aria-haspopup`, `aria-expanded`).
   */
  asChild?: boolean;
}

interface DropdownContentProps {
  children?: ReactNode;
  /** Alignment relative to trigger */
  align?: 'start' | 'center' | 'end';
  /** Side relative to trigger */
  side?: 'bottom' | 'top' | 'left' | 'right';
  /** Additional classes */
  className?: string;
}

interface DropdownItemProps {
  /** Label text */
  label?: string;
  /** Icon component */
  icon?: LucideIcon;
  /** Click handler */
  onClick?: () => void;
  /** Disabled state */
  disabled?: boolean;
  /** Show as a separator */
  separator?: boolean;
  /** Right element (shortcut, badge, etc.) */
  rightSlot?: ReactNode;
  /** Additional classes */
  className?: string;
}

/* ── Context ────────────────────────────────────────────────────────── */

import { createContext, useContext } from 'react';

interface DropdownContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  contentRef: React.RefObject<HTMLDivElement | null>;
}

const DropdownContext = createContext<DropdownContextValue | null>(null);

function useDropdownContext(): DropdownContextValue {
  const ctx = useContext(DropdownContext);
  if (!ctx) throw new Error('Dropdown sub-components must be used within <Dropdown>.');
  return ctx;
}

/* ── Dropdown Container ─────────────────────────────────────────────── */

export const Dropdown: FC<DropdownProps> & {
  Trigger: FC<DropdownTriggerProps>;
  Content: FC<DropdownContentProps>;
  Item: FC<DropdownItemProps>;
  Label: FC<DropdownLabelProps>;
  Divider: FC<DropdownDividerProps>;
} = ({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
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

  // Both the trigger and the content are rendered inside the container
  // wrapper div, so a single container ref is enough for click-outside
  // detection. The trigger never needs its own ref, which keeps the
  // asChild slot free of ref plumbing.
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Click outside handler
  useEffect(() => {
    if (!open) return;
    previousActiveElement.current = document.activeElement as HTMLElement;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current?.contains(e.target as Node)) return;
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
      previousActiveElement.current?.focus();
    };
  }, [open, setOpen]);

  return (
    <DropdownContext.Provider value={{ open, setOpen, contentRef }}>
      <div ref={containerRef} className={`relative inline-block ${className}`}>
        {children}
      </div>
    </DropdownContext.Provider>
  );
};

/* ── Dropdown Trigger ───────────────────────────────────────────────── */

const DropdownTrigger: FC<DropdownTriggerProps> = ({
  children,
  className = '',
  asChild = false,
}) => {
  const { open, setOpen } = useDropdownContext();

  // `asChild` (Radix-style slot): clone the child element and lift the
  // trigger behaviour onto it, rather than rendering a wrapping <button>.
  // Consumers use this when the trigger is already interactive (e.g.
  // IconButton / a plain <button>), which is what eliminates the invalid
  // "<button> cannot be a descendant of <button>" hierarchy.
  if (asChild && isValidElement(children)) {
    const child = children as React.ReactElement<{
      type?: 'button';
      'aria-haspopup'?: 'menu';
      'aria-expanded'?: boolean;
      onClick?: (e: ReactMouseEvent<HTMLElement>) => void;
      onKeyDown?: (e: ReactKeyboardEvent<HTMLElement>) => void;
    }>;
    return cloneElement(child, {
      type: 'button',
      'aria-haspopup': 'menu',
      'aria-expanded': open,
      onClick: (e: ReactMouseEvent<HTMLElement>) => {
        child.props.onClick?.(e);
        if (!e.defaultPrevented) setOpen(!open);
      },
      onKeyDown: (e: ReactKeyboardEvent<HTMLElement>) => {
        child.props.onKeyDown?.(e);
        if (!e.defaultPrevented && (e.key === 'Enter' || e.key === ' ')) {
          // Suppress the native button click so the menu does not toggle twice.
          e.preventDefault();
          setOpen(!open);
        }
      },
    });
  }

  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(!open); } }}
      aria-haspopup="menu"
      aria-expanded={open}
      className={className}
    >
      {children}
    </button>
  );
};

/* ── Dropdown Content ───────────────────────────────────────────────── */

const DropdownContent: FC<DropdownContentProps> = ({
  children,
  align = 'start',
  side = 'bottom',
  className = '',
}) => {
  const { open, contentRef } = useDropdownContext();

  if (!open) return null;

  const alignMap = {
    start: 'left-0',
    center: 'left-1/2 -translate-x-1/2',
    end: 'right-0',
  };

  const sideMap = {
    bottom: 'top-full mt-1',
    top: 'bottom-full mb-1',
    left: 'right-full mr-1',
    right: 'left-full ml-1',
  };

  // Arrow key navigation between menu items
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const menuEl = contentRef.current;
    if (!menuEl) return;
    const items = Array.from(
      menuEl.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])'),
    );
    if (items.length === 0) return;
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);
    let nextIndex: number;
    if (currentIndex === -1) {
      nextIndex = e.key === 'ArrowDown' ? 0 : items.length - 1;
    } else {
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      nextIndex = (currentIndex + delta + items.length) % items.length;
    }
    items[nextIndex]?.focus();
  };

  return (
    <div
      ref={contentRef}
      role="menu"
      onKeyDown={handleKeyDown}
      className={`
        absolute z-dropdown min-w-[160px] max-h-[320px] overflow-y-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-lg
        ${alignMap[align]}
        ${sideMap[side]}
        ${className}
      `}
    >
      {children}
    </div>
  );
};

/* ── Dropdown Item ──────────────────────────────────────────────────── */

const DropdownItem: FC<DropdownItemProps> = ({
  label,
  icon: IconComponent,
  onClick,
  disabled = false,
  separator = false,
  rightSlot,
  className = '',
}) => {
  const { setOpen } = useDropdownContext();

  if (separator) {
    return <hr className="my-1 border-t border-neutral-200" role="separator" />;
  }

  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={() => { if (!disabled) { onClick?.(); setOpen(false); } }}
      className={`
        flex w-full items-center gap-3 px-3 py-2 text-body-sm text-neutral-700
        transition-colors duration-100
        hover:bg-neutral-100
        disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent
        focus-visible:outline-none focus-visible:bg-neutral-100
        ${className}
      `}
    >
      {IconComponent && <Icon icon={IconComponent} size="sm" className="text-neutral-400" />}
      <span className="flex-1 text-left">{label}</span>
      {rightSlot && <span className="text-caption text-neutral-400">{rightSlot}</span>}
    </button>
  );
};

/* ── Dropdown Label (non-interactive section heading) ────────────────── */

interface DropdownLabelProps {
  children?: ReactNode;
  className?: string;
}

const DropdownLabel: FC<DropdownLabelProps> = ({ children, className = '' }) => {
  return (
    <p
      className={`px-3 py-1.5 text-caption font-semibold uppercase tracking-wider text-neutral-400 ${className}`}
    >
      {children}
    </p>
  );
};

/* ── Dropdown Divider (visual separator) ───────────────────────────── */

interface DropdownDividerProps {
  className?: string;
}

const DropdownDivider: FC<DropdownDividerProps> = ({ className = '' }) => {
  return (
    <hr className={`my-1 border-t border-neutral-200 ${className}`} role="separator" />
  );
};

/* ── Attach sub-components ───────────────────────────────────────────── */

Dropdown.Trigger = DropdownTrigger;
Dropdown.Content = DropdownContent;
Dropdown.Item = DropdownItem;
Dropdown.Label = DropdownLabel;
Dropdown.Divider = DropdownDivider;
