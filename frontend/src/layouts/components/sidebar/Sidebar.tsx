import { useState, type FC } from 'react';
import { SidebarContent } from './SidebarContent';
import { SidebarFooter } from './SidebarFooter';

/**
 * Sidebar — main application sidebar with collapsible navigation.
 *
 * Composes SidebarContent and SidebarFooter. Branding is NOT rendered here
 * — it lives in the global Header's fixed branding area (HeaderBranding),
 * which is aligned with the sidebar width on desktop.
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
 * - `forceVisible` renders the nav as a full-height (`h-full`) flex column
 *   so it is bounded by the MobileDrawer's viewport-height panel; that gives
 *   SidebarContent's `flex-1 overflow-y-auto` a real height constraint and
 *   makes the navigation area (not the page) the scroll container, with the
 *   footer pinned at the bottom.
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
        ${forceVisible ? 'flex h-full' : 'hidden lg:flex'}
        ${collapsed ? 'w-16' : 'w-[var(--sidebar-width)]'}
      `}
      aria-label="Sidebar navigation"
    >
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
