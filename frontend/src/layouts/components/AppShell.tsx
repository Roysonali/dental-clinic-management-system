import { useState, useEffect, useCallback, type FC, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { SidebarPlaceholder } from './SidebarPlaceholder';
import { HeaderPlaceholder } from './HeaderPlaceholder';
import { MobileDrawer } from './MobileDrawer';
import { Workspace } from './Workspace';
import { MobileNavProvider } from './mobile/MobileNavContext';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useIsMobileViewport } from '../../hooks/useIsMobileViewport';
import { useGlobalShortcut } from '../../hooks/useGlobalShortcut';
import { usePageTitle } from '../../hooks/usePageTitle';
import { MOBILE_COMPACT_HEADER_ROUTES } from '../../routes/routes';
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
 * └── Shell body (column)
 *     ├── HeaderPlaceholder     (full-width enterprise global header,
 *     │                          branding block aligned with the sidebar)
 *     └── Shell row
 *         ├── SidebarPlaceholder  (desktop only, visible on lg+)
 *         └── Workspace
 *             └── {children}
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
  const isMobileViewport = useIsMobileViewport();
  const location = useLocation();
  const pageTitle = usePageTitle();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // List pages that render their own compact mobile header (hamburger +
  // title + add action, reference screens 47/48) hide the global header at
  // the phone breakpoint. Detail pages and every other route keep the
  // global header. The compact header's hamburger opens this shell's drawer
  // via the MobileNavProvider below.
  const isCompactMobileHeader =
    isMobileViewport && MOBILE_COMPACT_HEADER_ROUTES.includes(location.pathname);

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

  // While the mobile navigation drawer is open the rest of the app is
  // made `inert`: pointer interaction, focus and background scrolling of
  // the main area are all blocked (the drawer panel itself is a sibling
  // and stays interactive). Backdrop click / Escape close the drawer and
  // remove `inert`, restoring normal interaction and scroll position.
  const mainAreaInert = isMobile && mobileDrawerOpen;

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
    <MobileNavProvider
      value={{ openNav: () => setMobileDrawerOpen(true), isOpen: mobileDrawerOpen }}
    >
      <div className="flex h-dvh w-full flex-col overflow-hidden bg-white">
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

        {/* ── Shell body (inert while the mobile nav drawer is open) ── */}
        <div
          className="flex min-h-0 flex-1 flex-col"
          {...(mainAreaInert ? { inert: true } : {})}
        >
          {/* ── Global Header (full-width enterprise top bar) ── */}
          {!isCompactMobileHeader && (
            <HeaderPlaceholder
              pageTitle={pageTitle}
              onToggleSidebar={handleToggleSidebar}
              onOpenCommandPalette={handleOpenCommandPalette}
              mobileDrawerOpen={mobileDrawerOpen}
            />
          )}

          {/* ── Shell row: sidebar + workspace ──────────────── */}
          <div className="flex min-h-0 flex-1">
            {/* ── Desktop Sidebar ──────────────────────────── */}
            <SidebarPlaceholder
              collapsed={sidebarCollapsed}
              onCollapsedChange={handleSidebarCollapsedChange}
            />

            {/* ── Workspace ─────────────────────────────────── */}
            <div className="flex min-w-0 flex-1 flex-col">
              <Workspace>
                {children}
              </Workspace>
            </div>
          </div>
        </div>
      </div>
    </MobileNavProvider>
  );
};
