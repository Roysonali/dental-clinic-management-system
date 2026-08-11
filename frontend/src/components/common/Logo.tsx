import type { CSSProperties, FC } from 'react';
import markUrl from '../../assets/images/logo.png';
import nameplateUrl from '../../assets/images/name.png';

/* ── Asset facts ────────────────────────────────────────────────────
 * logo.png  — 500×500  brand mark (tooth / D·C monogram artwork)
 * name.png  — 970×257  complete "Dens Care" nameplate (tooth + wordmark)
 * Both are the standard navy/cyan variants designed for light surfaces.
 * On dark surfaces they are re-rendered white via CSS mask (variant
 * "light") — the artwork itself is never recreated.
 * ─────────────────────────────────────────────────────────────────── */

/** name.png aspect ratio (970 / 257). */
const NAMEPLATE_ASPECT = 970 / 257;

interface LogoProps {
  /** Additional classes for the row wrapper */
  className?: string;
  /** Show the DensCare nameplate beside the mark. Default: true */
  showText?: boolean;
  /**
   * Render ONLY the DensCare nameplate (no separate mark). Used where the
   * nameplate already carries the complete branding (e.g. the global header
   * branding block). When true, `size` is the nameplate's pixel height.
   */
  nameplateOnly?: boolean;
  /**
   * Brand colour treatment:
   * - `dark` (default) — the native navy artwork, for light backgrounds
   * - `light`          — the same artwork re-rendered white (CSS mask),
   *   for dark backgrounds (only dark/light variants are provided)
   */
  variant?: 'light' | 'dark';
  /** Mark height in px (square mark). Default: 32 */
  size?: number;
}

/* ── Masked (tinted) brand render ────────────────────────────────────
 * Renders an image's alpha channel as a solid colour. Used to show the
 * actual brand artwork in white on dark surfaces without recreating it. */

interface MaskedBrandProps {
  url: string;
  width: number;
  height: number;
  tint: string;
  label?: string;
  hidden?: boolean;
}

function MaskedBrand({ url, width, height, tint, label, hidden = false }: MaskedBrandProps) {
  const style: CSSProperties = {
    display: 'inline-block',
    width,
    height,
    backgroundColor: tint,
    WebkitMaskImage: `url(${url})`,
    maskImage: `url(${url})`,
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
  };

  if (hidden) {
    return <span style={style} aria-hidden="true" />;
  }
  return <span style={style} role="img" aria-label={label} />;
}

/**
 * DensCare Logo — shared branding component.
 *
 * Renders the ACTUAL brand assets (`logo.png` mark + `name.png`
 * nameplate). Variants:
 * - `<Logo />`                 → mark + DensCare nameplate (default, navy)
 * - `<Logo showText={false} />`→ mark only (compact/mobile)
 * - `<Logo nameplateOnly />`   → nameplate only (header branding block)
 * - `<Logo variant="light" />` → white rendition for dark surfaces
 *
 * Accessibility: the nameplate carries the accessible "DensCare" name;
 * the mark is decorative when the nameplate is adjacent, and informative
 * when shown alone — so screen readers announce the brand exactly once.
 */
export const Logo: FC<LogoProps> = ({
  className = '',
  showText = true,
  nameplateOnly = false,
  variant = 'dark',
  size = 32,
}) => {
  // nameplateOnly always shows the nameplate — never a silent no-render.
  const showNameplate = nameplateOnly || showText;
  const tint = '#ffffff';
  // When nameplate-only, `size` IS the nameplate height; otherwise the
  // nameplate scales proportionally to the square mark.
  const nameplateHeight = nameplateOnly ? size : Math.round(size * 0.6);
  const nameplateWidth = Math.round(nameplateHeight * NAMEPLATE_ASPECT);

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {!nameplateOnly &&
        (variant === 'dark' ? (
          <img
            src={markUrl}
            alt={showNameplate ? '' : 'DensCare'}
            width={size}
            height={size}
            style={{ width: size, height: size }}
            className="shrink-0"
          />
        ) : (
          <MaskedBrand
            url={markUrl}
            width={size}
            height={size}
            tint={tint}
            hidden={showNameplate}
            label="DensCare"
          />
        ))}

      {showNameplate &&
        (variant === 'dark' ? (
          <img
            src={nameplateUrl}
            alt="DensCare"
            width={nameplateWidth}
            height={nameplateHeight}
            style={{ width: nameplateWidth, height: nameplateHeight }}
            className="shrink-0"
          />
        ) : (
          <MaskedBrand
            url={nameplateUrl}
            width={nameplateWidth}
            height={nameplateHeight}
            tint={tint}
            label="DensCare"
          />
        ))}
    </div>
  );
};
