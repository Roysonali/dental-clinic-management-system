import type { FC } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Icon } from '../common/Icon/Icon';
import { Skeleton } from '../common/Skeleton/Skeleton';

interface BillingKpiCardProps {
  /** Lucide icon for the metric (small, restrained accent colour). */
  icon: LucideIcon;
  /** Metric label — rendered uppercase/small/muted per the dashboard scale. */
  label: string;
  /** Pre-formatted metric value (currency or count). */
  value: string;
  /** Supporting description aligned to the backend contract semantics. */
  description?: string;
  /** Icon colour class (existing theme status colours only). */
  iconClassName?: string;
  /** Skeleton placeholder that preserves the card's final dimensions. */
  loading?: boolean;
  /** Error state — value renders as "—" with an "Unavailable" hint. */
  unavailable?: boolean;
}

/**
 * BillingKpiCard — a single key-performance-indicator card.
 *
 * Mirrors the visual language of the shared StatCard (same border/radius/
 * shadow/typography tokens) with per-metric icon colouring and a description
 * line, so the KPI grid stays balanced when numbers have different lengths
 * (`tabular-nums`, `truncate`, fixed-height tiles). No new design tokens.
 */
export const BillingKpiCard: FC<BillingKpiCardProps> = ({
  icon,
  label,
  value,
  description,
  iconClassName = 'text-primary-600',
  loading = false,
  unavailable = false,
}) => {
  if (loading) {
    return (
      <div
        role="status"
        aria-label={`Loading ${label}`}
        className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm lg:p-5"
      >
        <div className="flex items-center gap-3">
          <Skeleton variant="avatar" className="h-10 w-10 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton variant="badge" className="w-24" />
            <Skeleton variant="stat" className="w-16" />
          </div>
        </div>
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm lg:p-5">
      <div className="flex items-center justify-between gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100 ${iconClassName}`}
        >
          <Icon icon={icon} size="lg" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-caption font-medium uppercase tracking-wide text-neutral-500">
            {label}
          </p>
          <p className="mt-0.5 truncate font-semibold tracking-tight text-neutral-900 tabular-nums text-h2">
            {unavailable ? '—' : value}
          </p>
        </div>
      </div>
      <p className="mt-2.5 text-caption text-neutral-400">
        {unavailable ? 'Unavailable' : description}
      </p>
    </div>
  );
};
