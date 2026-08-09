import { Skeleton } from '../../common/Skeleton/Skeleton';
import { Card } from '../../common/Card/Card';

export const CreditNoteDetailSkeleton = () => (
  <div className="flex w-full min-w-0 flex-col gap-6">
    <Card>
      <Card.Body>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
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
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="mt-1 h-3 w-48" />
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
            <div className="mt-4 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </Card.Body>
        </Card>
      </div>
    </div>
  </div>
);
