import { useState, useRef, useEffect, useCallback, type FC, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Icon } from '../Icon/Icon';

/* ── Types ────────────────────────────────────────────────────────── */

interface ContextMenuProps {
  /** Trigger content (right-click target) */
  children?: ReactNode;
  /** Menu items */
  items: ContextMenuItemProps[];
  /** Additional classes for the trigger wrapper */
  className?: string;
}

interface ContextMenuItemProps {
  label?: string;
  icon?: LucideIcon;
  onClick?: () => void;
  disabled?: boolean;
  separator?: boolean;
  /** Nested sub-menu items */
  children?: ContextMenuItemProps[];
  rightSlot?: ReactNode;
}

/* ── Context Menu State ─────────────────────────────────────────────── */

interface MenuPosition {
  x: number;
  y: number;
}

const MENU_WIDTH = 200;
const MENU_HEIGHT_ESTIMATE = 300;

/**
 * ContextMenu — right-click contextual menu with viewport boundary clamping.
 *
 * @example
 * ```tsx
 * <ContextMenu
 *   items={[
 *     { label: 'Edit', icon: Pencil, onClick: () => {} },
 *     { label: 'Delete', icon: Trash2, onClick: () => {}, disabled: true },
 *     { separator: true },
 *     { label: 'Properties', icon: Info, onClick: () => {} },
 *   ]}
 * >
 *   <div className="p-8 border-2 border-dashed">Right-click me</div>
 * </ContextMenu>
 * ```
 */
export const ContextMenu: FC<ContextMenuProps> = ({
  children,
  items,
  className = '',
}) => {
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const open = position !== null;

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();

    // Clamp to viewport bounds to prevent overflow
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const x = Math.min(e.clientX, vw - MENU_WIDTH - 16);
    const y = Math.min(e.clientY, vh - MENU_HEIGHT_ESTIMATE - 16);
    const clampedX = Math.max(8, x);
    const clampedY = Math.max(8, y);

    setPosition({ x: clampedX, y: clampedY });
  }, []);

  const close = useCallback(() => setPosition(null), []);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) close();
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    const handleScroll = () => close();
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [open, close]);

  return (
    <div className={className} onContextMenu={handleContextMenu}>
      {children}

      {open && (
        <div
          ref={menuRef}
          style={{ left: position.x, top: position.y }}
          className="fixed z-dropdown min-w-[180px] rounded-lg border border-neutral-200 bg-white py-1 shadow-lg"
          role="menu"
        >
          {items.map((item, i) => (
            <ContextMenuItem key={i} {...item} onClose={close} />
          ))}
        </div>
      )}
    </div>
  );
};

/* ── Single Menu Item (with optional nesting) ────────────────────────── */

interface ContextMenuItemInnerProps extends ContextMenuItemProps {
  onClose: () => void;
}

const ContextMenuItem: FC<ContextMenuItemInnerProps> = ({
  label,
  icon: IconComponent,
  onClick,
  disabled = false,
  separator = false,
  children: nestedItems,
  rightSlot,
  onClose,
}) => {
  if (separator) {
    return <hr className="my-1 border-t border-neutral-200" role="separator" />;
  }

  const handleClick = () => {
    if (disabled || nestedItems) return;
    onClick?.();
    onClose();
  };

  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={handleClick}
      className={`
        flex w-full items-center gap-3 px-3 py-2 text-body-sm text-neutral-700
        transition-colors duration-100
        hover:bg-neutral-100
        disabled:cursor-not-allowed disabled:opacity-50
        focus-visible:outline-none focus-visible:bg-neutral-100
      `}
    >
      {IconComponent && <Icon icon={IconComponent} size="sm" className="text-neutral-400" />}
      <span className="flex-1 text-left">{label}</span>
      {rightSlot && <span className="text-caption text-neutral-400">{rightSlot}</span>}
      {nestedItems && <span className="text-neutral-300">▸</span>}
    </button>
  );
};
