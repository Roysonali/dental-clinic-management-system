import type { FC } from 'react';
import { Sidebar } from './sidebar/Sidebar';

/**
 * SidebarPlaceholder — renders the Sidebar component.
 *
 * This file exists as a stable import target for AppShell.
 * The actual Sidebar implementation lives in ./sidebar/Sidebar.tsx.
 * AppShell imports SidebarPlaceholder and will continue to do so
 * across all sprints without requiring import path changes.
 *
 * @example
 * ```tsx
 * <SidebarPlaceholder collapsed={false} onCollapsedChange={fn} />
 * ```
 */
interface SidebarPlaceholderProps {
  /** Sidebar collapsed state (omit for uncontrolled mode) */
  collapsed?: boolean;
  /** Collapse state change handler */
  onCollapsedChange?: (collapsed: boolean) => void;
}

export const SidebarPlaceholder: FC<SidebarPlaceholderProps> = ({
  collapsed,
  onCollapsedChange,
}) => {
  return (
    <Sidebar
      collapsed={collapsed}
      onCollapsedChange={onCollapsedChange}
    />
  );
};
