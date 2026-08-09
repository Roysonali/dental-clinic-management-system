import type { FC, ReactNode } from 'react';

interface MobileCardProps {
  /** Card content — use `span className="block"` for block-level lines
   * (keeps valid HTML when the card renders as a <button>). */
  children: ReactNode;
  /** Navigates when the whole card is tapped (renders as a <button>). */
  onClick?: () => void;
  /** Accessible label when clickable. */
  ariaLabel?: string;
  /** Additional classes. */
  className?: string;
}

/**
 * MobileCard — shared card shell for mobile list screens (reference cards:
 * white background, ~1px light border, rounded-2xl, subtle shadow, generous
 * internal padding, full available width). Clickable cards render as a
 * <button> so the entire card is a ≥44px touch target.
 */
export const MobileCard: FC<MobileCardProps> = ({
  children,
  onClick,
  ariaLabel,
  className = '',
}) => {
  const base = `rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm ${className}`;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        className={`${base} block w-full text-left transition-colors duration-150 hover:bg-neutral-50 active:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500`}
      >
        {children}
      </button>
    );
  }

  return <div className={base}>{children}</div>;
};
