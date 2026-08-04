import { useState, useEffect, useCallback, type FC, type ReactNode } from 'react';
import { SidebarPlaceholder } from './SidebarPlaceholder';
import { HeaderPlaceholder } from './HeaderPlaceholder';
import { MobileDrawer } from './MobileDrawer';
import { Workspace } from './Workspace';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useGlobalShortcut } from '../../hooks/useGlobalShortcut';
import { usePageTitle } from '../../hooks/usePageTitle';
import { CommandPaletteOverlay } from '../../components/common/CommandPalette/CommandPaletteOverlay';

/**
 * AppShell — overall application container.
 *
 * Owns the sidebar collapsed state and coordinates the toggle between
 * the Header toggle button and the Sidebar component.
 *
 * Responsive behaviour:
 * - Desktop (≥1024px): Header toggle collapses/expands the permanent Sidebar
 * - Mobile (<1024px):  Header toggle opens a slide-in Drawer containing the Sidebar
 *
 * Composes the authenticated layout structure:
 * - Sidebar region (permanent on desktop, Drawer-only on mobile)
 * - Main area (header + workspace)
 *
 * Actual layout hierarchy:
 * ```
 * AppShell
 * ├── MobileDrawer              (mobile only, renders Sidebar inside Drawer)
 * ├── SidebarPlaceholder        (desktop only, visible on lg+)
 * └── Main area
 *     ├── HeaderPlaceholder
 *     └── Workspace
 *         └── {children}
 * ```
 *
 * @example
 * ```tsx
 * <Route element={<DashboardLayout />}>
 *   <Route path="/dashboard" element={<DashboardPage />} />
 * </Route>
 * ```
 *
 * @param children — Required. Page content rendered in the workspace area.
 */
interface AppShellProps {
  /** Page content rendered inside the Workspace (typically an Outlet) */
  children: ReactNode;
}

export const AppShell: FC<AppShellProps> = ({ children }) => {
  const isMobile = useMediaQuery('(max-width: 1023px)');
  const pageTitle = usePageTitle();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // ── Global keyboard shortcut: Ctrl/Cmd + K ────────────
  const handleGlobalShortcut = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setCommandPaletteOpen((prev) => !prev);
    }
  }, []);
  useGlobalShortcut(handleGlobalShortcut);

  // ── Sidebar / Drawer toggle ───────────────────────────
  const handleToggleSidebar = () => {
    if (isMobile) {
      setMobileDrawerOpen((prev) => !prev);
    } else {
      setSidebarCollapsed((prev) => !prev);
    }
  };

  // Close mobile drawer when switching from mobile to desktop
  useEffect(() => {
    if (!isMobile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: reset drawer state when the viewport leaves mobile
      setMobileDrawerOpen(false);
    }
  }, [isMobile]);

  const handleCloseMobileDrawer = () => {
    setMobileDrawerOpen(false);
  };

  const handleSidebarCollapsedChange = (collapsed: boolean) => {
    setSidebarCollapsed(collapsed);
  };

  // ── Command palette ───────────────────────────────────
  const handleOpenCommandPalette = useCallback(() => {
    setCommandPaletteOpen(true);
  }, []);

  const handleCloseCommandPalette = useCallback(() => {
    setCommandPaletteOpen(false);
  }, []);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-white">
      {/* ── Command Palette Overlay ─────────────────────── */}
      <CommandPaletteOverlay
        open={commandPaletteOpen}
        onClose={handleCloseCommandPalette}
      />

      {/* ── Mobile Drawer ────────────────────────────────── */}
      <MobileDrawer
        open={mobileDrawerOpen}
        onClose={handleCloseMobileDrawer}
      />

      {/* ── Desktop Sidebar ──────────────────────────────── */}
      <SidebarPlaceholder
        collapsed={sidebarCollapsed}
        onCollapsedChange={handleSidebarCollapsedChange}
      />

      {/* ── Main Area ─────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <HeaderPlaceholder
          pageTitle={pageTitle}
          onToggleSidebar={handleToggleSidebar}
          onOpenCommandPalette={handleOpenCommandPalette}
        />
        <Workspace>
          {children}
        </Workspace>
      </div>
    </div>
  );
};
