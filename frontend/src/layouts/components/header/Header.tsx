import type { FC } from 'react';
import { HeaderLeft } from './HeaderLeft';
import { HeaderCenter } from './HeaderCenter';
import { HeaderRight } from './HeaderRight';

/**
 * Header — main application header bar.
 *
 * Composes HeaderLeft, HeaderCenter, and HeaderRight into a responsive
 * top bar that sits within the Application Shell.
 *
 * Uses the `--header-height` CSS custom property for consistent sizing.
 *
 * Layout:
 * ```
 * Header
 * ├── HeaderLeft   (sidebar toggle, breadcrumb, dynamic page title)
 * ├── HeaderCenter (search trigger)
 * └── HeaderRight  (notifications, user avatar)
 * ```
 *
 * Responsive behaviour:
 * - Desktop: full three-section layout with visible page title
 * - Tablet: compact spacing, search trigger remains visible
 * - Mobile: sidebar toggle visible, page title hidden, user avatar visible
 *
 * The Header is presentational — page title is injected from AppShell
 * via HeaderPlaceholder, keeping the route-resolution logic out of this component.
 *
 * @example
 * ```tsx
 * <Header pageTitle="Dashboard" onToggleSidebar={fn} onOpenCommandPalette={fn} />
 * ```
 */
export interface HeaderProps {
  /** Sidebar toggle callback */
  onToggleSidebar?: () => void;
  /** Command palette open callback */
  onOpenCommandPalette?: () => void;
  /** Dynamic page title derived from the current route */
  pageTitle?: string;
}

export const Header: FC<HeaderProps> = ({ onToggleSidebar, onOpenCommandPalette, pageTitle }) => {
  return (
    <header
      className="flex h-[var(--header-height)] shrink-0 items-center border-b border-neutral-200 bg-white px-4 sm:px-6"
      aria-label="App header"
    >
      <div className="flex w-full items-center gap-4">
        {/* ── Left Section ─────────────────────────────── */}
        <HeaderLeft onToggleSidebar={onToggleSidebar} pageTitle={pageTitle} />

        {/* ── Center Section (pushes right on mobile) ──── */}
        <div className="ml-auto sm:ml-0">
          <HeaderCenter onOpenCommandPalette={onOpenCommandPalette} />
        </div>

        {/* ── Right Section ────────────────────────────── */}
        <HeaderRight />
      </div>
    </header>
  );
};
