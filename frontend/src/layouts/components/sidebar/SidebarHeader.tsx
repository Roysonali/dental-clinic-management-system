import type { FC } from 'react';
import { Logo } from '../../../components/common/Logo';

interface SidebarHeaderProps {
  /** Whether sidebar is collapsed */
  collapsed: boolean;
}

/**
 * SidebarHeader — branding area at the top of the sidebar.
 *
 * Shows the full Logo in expanded mode, icon-only in collapsed mode.
 * Uses the existing Logo component from the Design System.
 */
export const SidebarHeader: FC<SidebarHeaderProps> = ({ collapsed }) => {
  return (
    <div className="flex h-[var(--header-height)] shrink-0 items-center border-b border-neutral-200 px-4">
      <div className="flex w-full items-center gap-3">
        {collapsed ? (
          <div className="flex w-full justify-center">
            <Logo showText={false} variant="dark" />
          </div>
        ) : (
          <Logo variant="dark" />
        )}
      </div>
    </div>
  );
};
