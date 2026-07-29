/**
 * DensCare Icon System
 * =====================
 *
 * Centralised wrapper around Lucide React icons.
 * Every icon in the application should go through this component
 * to ensure consistent sizing, colouring, and accessibility.
 *
 * Usage:
 *   import { Mail, Lock } from 'lucide-react';
 *   <Icon icon={Mail} size="md" />
 *
 * Import the icon directly from 'lucide-react' and pass it to <Icon />.
 * Do NOT use Lucide's <Mail /> directly — always wrap via <Icon icon={Mail} />.
 */

import type { FC } from 'react';
import type { LucideIcon } from 'lucide-react';

/* ── Size presets (matches typography scale) ───────────────────────── */

const iconSizes = {
  xs: 12,  // caption / small
  sm: 14,  // body-sm / label
  md: 16,  // body / button (default)
  lg: 20,  // h4
  xl: 24,  // h3
  '2xl': 32, // display
} as const;

export type IconSize = keyof typeof iconSizes;

/* ── Props ─────────────────────────────────────────────────────────── */

interface IconProps {
  /** Lucide icon component (imported from 'lucide-react') */
  icon: LucideIcon;
  /** Icon size preset */
  size?: IconSize;
  /** Additional Tailwind classes */
  className?: string;
  /** Accessible label (omit for decorative icons) */
  label?: string;
  /** Whether icon is purely decorative (defaults to true if no label) */
  decorative?: boolean;
}

/* ── Component ─────────────────────────────────────────────────────── */

export const Icon: FC<IconProps> = ({
  icon: LucideIconComponent,
  size = 'md',
  className = '',
  label,
  decorative = !label,
}) => {
  const pixelSize = iconSizes[size];

  return (
    <LucideIconComponent
      size={pixelSize}
      className={`shrink-0 ${className}`}
      aria-hidden={decorative ? 'true' : undefined}
      aria-label={decorative ? undefined : label}
      focusable="false"
    />
  );
};

/* ── Convenience: icon size map (for external use) ─────────────────── */
export { iconSizes };
