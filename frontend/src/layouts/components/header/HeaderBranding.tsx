import type { FC } from 'react';
import { Logo } from '../../../components/common/Logo';

/**
 * HeaderBranding — fixed application branding area (reference header left
 * section).
 *
 * Desktop (lg+): a fixed-width block aligned exactly with the sidebar below
 * (`w-[var(--sidebar-width)]` = 16rem ≈ the reference's ~240px), showing the
 * DensCare nameplate (`name.png` — the complete tooth + wordmark artwork),
 * with a subtle right border separating branding from application content.
 *
 * Below lg the sidebar is hidden, so the header shows a compact mark
 * (`logo.png`) instead — the wide nameplate is never squeezed into narrow
 * tablet/mobile headers (brand presence is preserved without distortion).
 *
 * Both renderings use the ACTUAL brand assets via the shared `Logo`
 * component — nothing is recreated.
 */
export const HeaderBranding: FC = () => {
  return (
    <>
      {/* Desktop: fixed branding block aligned with the sidebar width. */}
      <div
        data-testid="header-branding-desktop"
        className="hidden h-full w-[var(--sidebar-width)] shrink-0 items-center border-r border-neutral-200 px-4 lg:flex"
      >
        <Logo nameplateOnly size={38} />
      </div>

      {/* Tablet / mobile: compact mark. */}
      <div
        data-testid="header-branding-compact"
        className="flex h-full shrink-0 items-center px-3 lg:hidden"
      >
        <Logo showText={false} size={28} />
      </div>
    </>
  );
};
