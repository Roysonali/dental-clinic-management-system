import type { FC } from 'react';

export type DividerVariant = 'default' | 'subtle' | 'strong';
export type DividerOrientation = 'horizontal' | 'vertical';

interface DividerProps {
  /** Visual weight variant */
  variant?: DividerVariant;
  /** Orientation */
  orientation?: DividerOrientation;
  /** Optional label (horizontal only — centered in the divider) */
  label?: string;
  /** Additional classes */
  className?: string;
}

const variantStyles: Record<DividerVariant, string> = {
  default: 'border-neutral-200',
  subtle: 'border-neutral-100',
  strong: 'border-neutral-300',
};

/**
 * Divider — a visual separator between sections.
 * Supports horizontal (with optional centered label) and vertical modes.
 *
 * @example
 * ```tsx
 * <Divider />
 * <Divider variant="subtle" />
 * <Divider label="or" />
 * <Divider orientation="vertical" className="h-10" />
 * ```
 */
export const Divider: FC<DividerProps> = ({
  variant = 'default',
  orientation = 'horizontal',
  label,
  className = '',
}) => {
  if (orientation === 'vertical') {
    return (
      <div
        className={`inline-block w-px self-stretch bg-current ${variantStyles[variant]} ${className}`}
        role="separator"
        aria-orientation="vertical"
      />
    );
  }

  if (label) {
    return (
      <div
        className={`flex items-center gap-3 ${className}`}
        role="separator"
        aria-orientation="horizontal"
      >
        <hr className={`flex-1 border-t ${variantStyles[variant]}`} />
        <span className="text-caption font-medium text-neutral-400 shrink-0">{label}</span>
        <hr className={`flex-1 border-t ${variantStyles[variant]}`} />
      </div>
    );
  }

  return (
    <hr
      className={`border-t ${variantStyles[variant]} ${className}`}
      role="separator"
      aria-orientation="horizontal"
    />
  );
};
