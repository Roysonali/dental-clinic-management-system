import type { FC } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Icon } from '../Icon/Icon';

/**
 * PaletteResultRow — reusable result item for command palette or search results.
 *
 * Supports icon, title, subtitle, shortcut badge, disabled state, and active state.
 * The `id` prop is used for `aria-activedescendant` on the parent listbox input.
 *
 * @example
 * ```tsx
 * <PaletteResultRow
 *   icon={Users}
 *   label="Juan Dela Cruz"
 *   subtitle="Patient • DOB: 1990-05-15"
 *   shortcut="G P"
 *   active={true}
 *   onClick={handleClick}
 * />
 * ```
 */
interface PaletteResultRowProps {
  /** Optional id for aria-activedescendant referencing */
  id?: string;
  /** Icon component */
  icon: LucideIcon;
  /** Primary label */
  label: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Optional keyboard shortcut badge */
  shortcut?: string;
  /** Whether this item is visually active (highlighted) */
  active?: boolean;
  /** Whether this item is disabled */
  disabled?: boolean;
  /** Click handler */
  onClick?: () => void;
}

export const PaletteResultRow: FC<PaletteResultRowProps> = ({
  id,
  icon,
  label,
  subtitle,
  shortcut,
  active = false,
  disabled = false,
  onClick,
}) => {
  return (
    <button
      id={id}
      type="button"
      onClick={onClick}
      disabled={disabled}
      role="option"
      aria-selected={active || undefined}
      className={`
        flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-body-sm
        transition-colors duration-75
        ${active ? 'bg-primary-50 text-primary-700' : 'text-neutral-700 hover:bg-neutral-100'}
        ${disabled ? 'cursor-not-allowed opacity-50' : ''}
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500
      `}
    >
      <Icon
        icon={icon}
        size="sm"
        className={`shrink-0 ${active ? 'text-primary-500' : 'text-neutral-400'}`}
      />
      <div className="min-w-0 flex-1">
        <span className={active ? 'font-medium' : ''}>{label}</span>
        {subtitle && (
          <span className="ml-2 text-caption text-neutral-400">{subtitle}</span>
        )}
      </div>
      {shortcut && (
        <kbd className="shrink-0 rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-caption text-neutral-400 font-mono">
          {shortcut}
        </kbd>
      )}
    </button>
  );
};
