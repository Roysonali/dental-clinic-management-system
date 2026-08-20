import type { FC } from 'react';
import { HeaderBranding } from './HeaderBranding';
import { HeaderLeft } from './HeaderLeft';
import { HeaderCenter } from './HeaderCenter';
import { HeaderRight } from './HeaderRight';

/**
 * Header — enterprise global application header bar.
 *
 * One shared top bar rendered by the AppShell for every authenticated page.
 * Spans the full layout width and composes the two reference-header areas:
 *
 * ```
 * Header
 * ├── HeaderBranding (fixed branding area — logo + DensCare wordmark,
 * │                   aligned with the sidebar width on desktop)
 * └── HeaderMain (application content area)
 *     ├── HeaderLeft   (sidebar toggle, dynamic page title)
 *     ├── HeaderCenter (global search trigger, pushed right)
 *     └── HeaderRight  (notifications, user profile)
 * ```
 *
 * Uses the `--header-height` CSS custom property (64px) for consistent
 * sizing, so page content never shifts between pages.
 *
 * Responsive behaviour:
 * - Desktop (lg+): branding block + page title + search control visible
 * - Tablet (sm–lg): compact icon mark, narrower search, no page title
 * - Mobile (<sm): compact icon mark, sidebar toggle, search/notification/
 *   profile icons (list pages hide this header in favour of the compact
 *   MobilePageHeader — see MOBILE_COMPACT_HEADER_ROUTES)
 *
 * The Header is presentational — page title is injected from AppShell
 * via HeaderPlaceholder, keeping route-resolution logic out of this
 * component.
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
  /** Mobile navigation drawer open state (drives hamburger aria-expanded) */
  mobileDrawerOpen?: boolean;
}

export const Header: FC<HeaderProps> = ({ onToggleSidebar, onOpenCommandPalette, pageTitle, mobileDrawerOpen }) => {
  return (
    <header
      className="flex h-[var(--header-height)] shrink-0 items-center border-b border-neutral-200 bg-white"
      aria-label="App header"
    >
      {/* ── Fixed branding area ─────────────────────────── */}
      <HeaderBranding />

      {/* ── Application content area ────────────────────── */}
      <div className="flex min-w-0 flex-1 items-center gap-2 px-3 sm:gap-4 sm:px-6">
        {/* Left Section: sidebar toggle + dynamic page title */}
        <HeaderLeft onToggleSidebar={onToggleSidebar} pageTitle={pageTitle} mobileDrawerOpen={mobileDrawerOpen} />

        {/* Center Section: global search — pushed to the right side,
            immediately before notifications / user profile. */}
        <div className="ml-auto flex items-center">
          <HeaderCenter onOpenCommandPalette={onOpenCommandPalette} />
        </div>

        {/* Right Section: notifications + user profile */}
        <HeaderRight />
      </div>
    </header>
  );
};
