import type { FC } from 'react';
import { Skeleton } from '../../common/Skeleton/Skeleton';
import { Card } from '../../common/Card/Card';

/**
 * RefundDetailSkeleton — skeleton placeholder for the refund timeline layout.
 * Mirrors the final geometry (header, timeline card, summary + reason cards).
 */
export const RefundDetailSkeleton: FC = () => (
  <div
    className="flex w-full min-w-0 flex-col gap-6"
    role="status"
    aria-label="Loading refund"
    aria-busy="true"
  >
    <Card>
      <Card.Body>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Skeleton variant="button" className="w-20" />
            <Skeleton variant="title" className="w-44" />
            <Skeleton variant="badge" className="w-24" />
          </div>
          <Skeleton variant="button" className="w-32" />
        </div>
      </Card.Body>
    </Card>

    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Card>
          <Card.Body>
            <Skeleton className="mb-4 h-6 w-40" />
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-3 w-3 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="mt-1 h-3 w-56" />
                  </div>
                </div>
              ))}
            </div>
          </Card.Body>
        </Card>
      </div>
      <div className="space-y-6">
        <Card>
          <Card.Body>
            <Skeleton className="h-6 w-32" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          </Card.Body>
        </Card>
        <Card>
          <Card.Body>
            <Skeleton className="h-6 w-24" />
            <Skeleton className="mt-3 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-3/4" />
          </Card.Body>
        </Card>
      </div>
    </div>
  </div>
);
