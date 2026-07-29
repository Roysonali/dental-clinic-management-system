import { useState, useRef, useEffect, useCallback, type FC, type ReactNode } from 'react';
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
  triggerRef: React.RefObject<HTMLDivElement | null>;
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

  const triggerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  // Click outside handler
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
    <DropdownContext.Provider value={{ open, setOpen, triggerRef, contentRef }}>
      <div className={`relative inline-block ${className}`}>
        {children}
      </div>
    </DropdownContext.Provider>
  );
};

/* ── Dropdown Trigger ───────────────────────────────────────────────── */

const DropdownTrigger: FC<DropdownTriggerProps> = ({ children, className = '' }) => {
  const { open, setOpen, triggerRef } = useDropdownContext();

  return (
    <button
      ref={triggerRef}
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

  return (
    <div
      ref={contentRef}
      role="menu"
      className={`
        absolute z-dropdown min-w-[180px] rounded-lg border border-neutral-200 bg-white py-1 shadow-lg
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

/* ── Attach sub-components ───────────────────────────────────────────── */

Dropdown.Trigger = DropdownTrigger;
Dropdown.Content = DropdownContent;
Dropdown.Item = DropdownItem;
