import type { FC } from 'react';
import { PanelLeft } from 'lucide-react';
import { Icon } from '../../../components/common/Icon/Icon';
import { IconButton } from '../../../components/common/Button/IconButton';

/**
 * HeaderLeft — left section of the global header content area.
 *
 * Contains:
 * - Sidebar collapse/expand trigger (wired to AppShell state; opens the
 *   navigation drawer on mobile)
 * - Dynamic page title derived from the current route (desktop only — on
 *   mobile the list screens render their own compact MobilePageHeader, and
 *   detail screens keep the header uncluttered)
 *
 * @example
 * ```tsx
 * <HeaderLeft onToggleSidebar={fn} pageTitle="Dashboard" />
 * ```
 */
export interface HeaderLeftProps {
  /** Sidebar toggle callback */
  onToggleSidebar?: () => void;
  /** Dynamic page title from the current route */
  pageTitle?: string;
  /** Mobile navigation drawer open state (drives hamburger aria-expanded) */
  mobileDrawerOpen?: boolean;
}

export const HeaderLeft: FC<HeaderLeftProps> = ({ onToggleSidebar, pageTitle = 'Dashboard', mobileDrawerOpen = false }) => {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {/* Sidebar toggle — visible at all breakpoints */}
      <IconButton
        icon={<Icon icon={PanelLeft} size="md" />}
        variant="ghost"
        size="sm"
        aria-label="Toggle sidebar"
        aria-expanded={mobileDrawerOpen}
        className="inline-flex"
        onClick={onToggleSidebar}
      />

      {/* Page title — current module context, visible at every breakpoint
          (truncates on narrow screens). Mobile list screens replace the
          global header with the compact MobilePageHeader, so this title
          serves detail screens and tablets. */}
      <span className="min-w-0 truncate text-h4 font-semibold text-neutral-900">
        {pageTitle}
      </span>
    </div>
  );
};
