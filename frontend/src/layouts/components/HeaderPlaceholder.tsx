import type { FC } from 'react';
import { Header } from './header/Header';

/**
 * HeaderPlaceholder — renders the Header component.
 *
 * This file exists as a stable import target for AppShell.
 * The actual Header implementation lives in ./header/Header.tsx.
 *
 * Receives `pageTitle` from AppShell (derived via usePageTitle hook)
 * and passes it down to Header → HeaderLeft.
 *
 * @example
 * ```tsx
 * <HeaderPlaceholder pageTitle="Dashboard" onToggleSidebar={fn} />
 * ```
 */
interface HeaderPlaceholderProps {
  /** Sidebar toggle callback (wired from AppShell) */
  onToggleSidebar?: () => void;
  /** Command palette open callback */
  onOpenCommandPalette?: () => void;
  /** Dynamic page title from route metadata */
  pageTitle?: string;
  /** Mobile navigation drawer open state (drives hamburger aria-expanded) */
  mobileDrawerOpen?: boolean;
}

export const HeaderPlaceholder: FC<HeaderPlaceholderProps> = ({
  onToggleSidebar,
  onOpenCommandPalette,
  pageTitle,
  mobileDrawerOpen,
}) => {
  return (
    <Header
      onToggleSidebar={onToggleSidebar}
      onOpenCommandPalette={onOpenCommandPalette}
      pageTitle={pageTitle}
      mobileDrawerOpen={mobileDrawerOpen}
    />
  );
};
