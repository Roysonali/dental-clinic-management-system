import { useState, type FC } from 'react';
import { History, RotateCcw } from 'lucide-react';
import { Timeline } from '../common/Timeline/Timeline';
import { Button } from '../common/Button/Button';
import { Badge } from '../common/Badge/Badge';
import { Icon } from '../common/Icon/Icon';
import { Skeleton } from '../common/Skeleton/Skeleton';
import { useQuery } from '@tanstack/react-query';
import { treatmentPlanService } from '../../services/treatmentPlanService';
import { treatmentPlanQueryKeys } from '../../hooks/treatmentPlans/treatmentPlanQueryKeys';
import { formatISODate } from '../../utils/date';
import { formatTreatmentCost } from '../../utils/treatmentPlanFormatting';
import type { VersionListItem } from '../../types/treatmentPlan';

interface VersionTimelineProps {
  planId: string;
  versions: VersionListItem[];
  /** Restore requires an editable plan status (backend 409 otherwise). */
  canRestore: boolean;
  submitting?: boolean;
  onRestore: (version: VersionListItem) => void;
  className?: string;
}

/**
 * VersionTimeline — S-05 version list + expandable diff ([MAP §3.5]).
 *
 * Rows come from the plan aggregate (no extra fetch). Expanding a version
 * lazily fetches `GET /treatment-plans/{id}/versions/{versionId}` — the
 * diff panel renders snapshot items with money parsed from strings.
 */
export const VersionTimeline: FC<VersionTimelineProps> = ({
  planId,
  versions,
  canRestore,
  submitting = false,
  onRestore,
  className = '',
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const diffQuery = useQuery({
    queryKey: treatmentPlanQueryKeys.version(planId, expandedId ?? ''),
    queryFn: () => treatmentPlanService.getVersion(planId, expandedId as string),
    enabled: expandedId !== null,
    staleTime: 5 * 60 * 1000,
  });

  if (versions.length === 0) {
    return (
      <p className={`text-body-sm text-neutral-500 ${className}`}>
        No versions have been created yet. Create a version to snapshot the current plan items.
      </p>
    );
  }

  return (
    <div className={className}>
      <Timeline
        items={versions.map((version) => {
          const isExpanded = version.id === expandedId;
          return {
            icon: History,
            iconColor: isExpanded ? 'text-primary-500 border-primary-500' : 'text-neutral-400',
            title: `Version ${version.version_number}`,
            timestamp: formatISODate(version.created_at),
            description: version.change_reason,
            extra: (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="ghost" size="xs" onClick={() => setExpandedId(isExpanded ? null : version.id)}>
                    {isExpanded ? 'Hide diff' : 'Show diff'}
                  </Button>
                  {canRestore && (
                    <Button
                      variant="outline"
                      size="xs"
                      disabled={submitting}
                      onClick={() => onRestore(version)}
                      leftIcon={<Icon icon={RotateCcw} size="xs" />}
                    >
                      Restore
                    </Button>
                  )}
                </div>

                {isExpanded && (
                  <div className="rounded-lg border border-neutral-200 bg-neutral-50/60 p-3" role="region" aria-label={`Version ${version.version_number} snapshot`}>
                    {diffQuery.isPending ? (
                      <Skeleton variant="table-row" className="h-8 w-full" />
                    ) : diffQuery.isError ? (
                      <p className="text-body-sm text-danger">Failed to load version snapshot.</p>
                    ) : diffQuery.data ? (
                      <ul className="divide-y divide-neutral-200">
                        {diffQuery.data.items_snapshot.items.map((item) => (
                          <li key={item.sequence_number} className="flex items-center justify-between gap-2 py-1.5 text-body-sm">
                            <span className="min-w-0 truncate text-neutral-700">
                              <span className="font-mono text-neutral-400">{item.sequence_number}.</span>{' '}
                              {item.procedure_code}
                              {item.tooth_number != null && <span className="text-neutral-400"> · #{item.tooth_number}{item.tooth_surface ? ` (${item.tooth_surface})` : ''}</span>}
                            </span>
                            <span className="shrink-0 tabular-nums text-neutral-800">
                              {formatTreatmentCost(item.estimated_cost)}
                              {item.discount ? <span className="text-neutral-400"> (−{formatTreatmentCost(item.discount)})</span> : null}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <Badge variant="neutral" size="xs" className="mt-2">
                      Snapshot captured {formatISODate(diffQuery.data?.items_snapshot.captured_at)}
                    </Badge>
                  </div>
                )}
              </div>
            ),
          };
        })}
      />
    </div>
  );
};
