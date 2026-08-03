import type { FC } from 'react';
import { PanelLeft } from 'lucide-react';
import { Icon } from '../../../components/common/Icon/Icon';
import { IconButton } from '../../../components/common/Button/IconButton';
import { Breadcrumb } from '../../../components/common/Breadcrumb/Breadcrumb';

/**
 * HeaderLeft — left section of the application header.
 *
 * Contains:
 * - Sidebar collapse/expand trigger (wired to AppShell state)
 * - Breadcrumb region (wired via route metadata)
 * - Dynamic page title derived from the current route
 *
 * @example
 * ```tsx
 * <HeaderLeft onToggleSidebar={fn} pageTitle="Dashboard" />
 * ```
 */
interface HeaderLeftProps {
  /** Sidebar toggle callback */
  onToggleSidebar?: () => void;
  /** Dynamic page title from the current route */
  pageTitle?: string;
}

export const HeaderLeft: FC<HeaderLeftProps> = ({ onToggleSidebar, pageTitle = 'Dashboard' }) => {
  return (
    <div className="flex items-center gap-3 min-w-0">
      {/* Sidebar toggle — visible at all breakpoints */}
      <IconButton
        icon={<Icon icon={PanelLeft} size="md" />}
        variant="ghost"
        size="sm"
        aria-label="Toggle sidebar"
        className="inline-flex"
        onClick={onToggleSidebar}
      />

      {/* Breadcrumb (placeholder — empty until proper breadcrumb implementation in future sprint) */}
      <Breadcrumb
        items={[]}
        maxItems={0}
      />

      {/* Page title (hidden on mobile) */}
      <span className="hidden text-h4 font-semibold text-neutral-900 lg:inline">
        {pageTitle}
      </span>
    </div>
  );
};
