import type { FC, ReactNode } from 'react';

/**
 * QuickActionCard — clickable card for quick actions on the dashboard.
 *
 * Placeholder component — no business logic.
 *
 * @example
 * ```tsx
 * <QuickActionCard
 *   icon={<Icon icon={UserPlus} size="xl" className="text-primary-500" />}
 *   label="New Patient"
 *   onClick={() => {}}
 * />
 * ```
 */
interface QuickActionCardProps {
  /** Icon element */
  icon: ReactNode;
  /** Action label */
  label: string;
  /** Click handler */
  onClick?: () => void;
}

export const QuickActionCard: FC<QuickActionCardProps> = ({
  icon,
  label,
  onClick,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-3 rounded-xl border border-neutral-200 bg-white p-5 transition-all duration-150
        hover:border-primary-300 hover:shadow-sm
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50">
        {icon}
      </div>
      <span className="text-body-sm font-medium text-neutral-700">
        {label}
      </span>
    </button>
  );
};
