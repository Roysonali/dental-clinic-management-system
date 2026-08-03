import { useState, type FC } from 'react';
import { SidebarHeader } from './SidebarHeader';
import { SidebarContent } from './SidebarContent';
import { SidebarFooter } from './SidebarFooter';

/**
 * Sidebar — main application sidebar with collapsible navigation.
 *
 * Composes SidebarHeader, SidebarContent, and SidebarFooter.
 *
 * Supports both controlled and uncontrolled collapse state:
 *
 * **Uncontrolled mode** (default):
 * ```tsx
 * <Sidebar />  // manages its own collapsed state
 * ```
 *
 * **Controlled mode** (for future Drawer/Sprint 4 integration):
 * ```tsx
 * <Sidebar collapsed={isCollapsed} onCollapsedChange={setIsCollapsed} />
 * ```
 *
 * Desktop behaviour:
 * - Expanded: full width (256px), shows labels, groups, branding
 * - Collapsed: narrow width (64px), icons only, tooltips on hover
 *
 * Mobile readiness:
 * - Uses hidden on mobile (lg:flex), ready for Drawer integration in Sprint 4
 * - Structure is framework-agnostic: can be moved into a Drawer without refactoring
 *
 * @example
 * ```tsx
 * <Sidebar />  // Used inside AppShell via SidebarPlaceholder
 * ```
 */
export interface SidebarProps {
  /** Controlled collapsed state (omit for uncontrolled) */
  collapsed?: boolean;
  /** Controlled collapse change handler */
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Force the sidebar to always render as flex (used inside MobileDrawer) */
  forceVisible?: boolean;
}

export const Sidebar: FC<SidebarProps> = ({ collapsed: controlledCollapsed, onCollapsedChange, forceVisible = false }) => {
  const [internalCollapsed, setInternalCollapsed] = useState(false);

  // Controlled vs uncontrolled
  const isControlled = controlledCollapsed !== undefined;
  const collapsed = isControlled ? controlledCollapsed : internalCollapsed;

  const handleToggleCollapse = () => {
    const next = !collapsed;
    if (isControlled) {
      onCollapsedChange?.(next);
    } else {
      setInternalCollapsed(next);
    }
  };

  return (
    <nav
      className={`
        shrink-0 flex-col border-r border-neutral-200 bg-white transition-[width] duration-200
        ${forceVisible ? 'flex' : 'hidden lg:flex'}
        ${collapsed ? 'w-16' : 'w-[var(--sidebar-width)]'}
      `}
      aria-label="Sidebar navigation"
    >
      {/* ── Branding ──────────────────────────────────── */}
      <SidebarHeader collapsed={collapsed} />

      {/* ── Navigation ────────────────────────────────── */}
      <SidebarContent collapsed={collapsed} />

      {/* ── Footer ────────────────────────────────────── */}
      <SidebarFooter
        collapsed={collapsed}
        onToggleCollapse={handleToggleCollapse}
      />
    </nav>
  );
};
