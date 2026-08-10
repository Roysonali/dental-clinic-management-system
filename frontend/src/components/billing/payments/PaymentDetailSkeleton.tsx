import type { FC } from 'react';
import { Skeleton } from '../../common/Skeleton/Skeleton';

/**
 * PaymentDetailSkeleton — skeleton placeholder for the detail layout.
 *
 * Mirrors the final geometry (header, overview cards, main column with
 * allocations + notes, right column with financial summary, receipt and
 * record cards) so nothing jumps when data arrives.
 */
export const PaymentDetailSkeleton: FC = () => {
  return (
    <div
      className="flex flex-col gap-6"
      role="status"
      aria-label="Loading payment"
      aria-busy="true"
    >
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Skeleton variant="button" className="w-20" />
          <Skeleton variant="title" className="w-44" />
          <Skeleton variant="badge" className="w-24" />
        </div>
        <div className="flex gap-2">
          <Skeleton variant="button" className="w-24" />
          <Skeleton variant="button" className="w-24" />
        </div>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <Skeleton variant="text" className="w-20" />
            <Skeleton variant="stat" className="mt-3 w-32" />
            <Skeleton variant="text" className="mt-1.5 w-24" />
          </div>
        ))}
      </div>

      {/* Main + right column */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-neutral-200 bg-white shadow-sm lg:col-span-2">
          <div className="border-b border-neutral-200 px-5 py-4">
            <Skeleton variant="title" className="w-32" />
          </div>
          <div className="space-y-3 p-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} variant="table-row" className="h-12" />
            ))}
          </div>
        </div>
        <div className="space-y-6">
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <Skeleton variant="title" className="w-40" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-4">
                  <Skeleton variant="text" className="w-24" />
                  <Skeleton variant="stat" className="w-20" />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <Skeleton variant="title" className="w-24" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-4">
                  <Skeleton variant="text" className="w-20" />
                  <Skeleton variant="text" className="w-24" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
