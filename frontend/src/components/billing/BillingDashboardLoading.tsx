import type { FC } from 'react';
import { BillingKpiGrid } from './BillingKpiGrid';
import { Skeleton } from '../common/Skeleton/Skeleton';

/**
 * BillingDashboardLoading — skeleton placeholder for the populated layout.
 *
 * Mirrors the final layout (KPI grid + patient summary card + two-column
 * recent activity) so nothing jumps when data arrives: KPI card skeletons,
 * then a patient-summary-shaped skeleton, then recent-section row skeletons.
 * No spinner, no fake data.
 */
export const BillingDashboardLoading: FC = () => {
  return (
    <div
      className="flex flex-col gap-6"
      role="status"
      aria-label="Loading billing dashboard"
      aria-busy="true"
    >
      {/* KPI grid (10 cards, same grid as populated) */}
      <BillingKpiGrid loading />

      {/* Patient financial summary card skeleton */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <Skeleton variant="title" className="w-56" />
        <div className="mt-4">
          <Skeleton variant="button" className="w-full max-w-sm" />
        </div>
        <div className="mt-5 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <Skeleton variant="text" className="w-24" />
              <Skeleton variant="stat" className="w-20" />
            </div>
          ))}
        </div>
      </div>

      {/* Recent activity sections (two columns on desktop) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {[0, 1].map((section) => (
          <div key={section} className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <Skeleton variant="title" className="w-40" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton variant="avatar" className="h-8 w-8 rounded-full" />
                  <Skeleton variant="table-row" className="h-10 flex-1" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
