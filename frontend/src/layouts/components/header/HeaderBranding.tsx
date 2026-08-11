import type { FC } from 'react';
import { Logo } from '../../../components/common/Logo';

/**
 * HeaderBranding — fixed application branding area (reference header left
 * section).
 *
 * Desktop (lg+): a fixed-width block aligned exactly with the sidebar below
 * (`w-[var(--sidebar-width)]` = 16rem ≈ the reference's ~240px), showing the
 * DensCare logo + wordmark, with a subtle right border separating branding
 * from the application content (page title / search / notifications / user).
 *
 * Below lg the sidebar is hidden, so the header shows a compact icon-only
 * mark instead — keeping tablet/mobile headers uncluttered while preserving
 * brand presence. The full wordmark remains available on desktop only, per
 * the enterprise reference.
 *
 * The brand itself reuses the existing shared `Logo` component — no logo
 * recreated here. (Actual logo asset integration is a separate task.)
 */
export const HeaderBranding: FC = () => {
  return (
    <>
      {/* Desktop: fixed branding block aligned with the sidebar width. */}
      <div
        data-testid="header-branding-desktop"
        className="hidden h-full w-[var(--sidebar-width)] shrink-0 items-center border-r border-neutral-200 px-4 lg:flex"
      >
        <Logo variant="dark" />
      </div>

      {/* Tablet / mobile: compact icon-only mark. */}
      <div
        data-testid="header-branding-compact"
        className="flex h-full shrink-0 items-center px-3 lg:hidden"
      >
        <Logo showText={false} variant="dark" />
      </div>
    </>
  );
};
