import type { FC } from 'react';
import { Card } from '../../common/Card/Card';
import { formatRefundDateTime } from '../../../utils/refundFormatting';
import { buildRefundTimeline, type RefundTimelineMarker } from '../../../utils/refundTimeline';
import type { RefundRead } from '../../../types/billing';

interface RefundTimelineCardProps {
  refund: RefundRead;
}

const markerClasses: Record<RefundTimelineMarker, string> = {
  completed: 'border-success bg-success',
  current: 'border-primary-500 bg-primary-500',
  'current-danger': 'border-danger bg-danger',
  future: 'border-neutral-300 bg-white',
};

/**
 * RefundTimelineCard — large REFUND TIMELINE card (reference spec §19).
 *
 * Vertical timeline with a connecting line, circular markers (green for
 * completed events, blue for the current event, red for a rejected current
 * state, hollow gray for future/not-applicable), bold titles and muted
 * actor/timestamp secondary text. Events are derived from the real refund
 * aggregate (see `buildRefundTimeline` in utils/refundTimeline).
 */
export const RefundTimelineCard: FC<RefundTimelineCardProps> = ({ refund }) => {
  const items = buildRefundTimeline(refund);

  return (
    <Card>
      <Card.Header title="Refund Timeline" />
      <Card.Body>
        <div className="flex flex-col" role="list" aria-label="Refund timeline">
          {items.map((item, index) => (
            <div key={`${item.title}-${index}`} className="relative flex gap-4 pb-6 last:pb-0" role="listitem">
              <div className="flex flex-col items-center">
                <span
                  aria-hidden="true"
                  className={`mt-1 h-3 w-3 shrink-0 rounded-full border-2 ${markerClasses[item.marker]}`}
                />
                {index < items.length - 1 && (
                  <span aria-hidden="true" className="mt-1 w-0.5 flex-1 bg-neutral-200" />
                )}
              </div>
              <div className="min-w-0 flex-1 pb-1">
                <p
                  className={`text-body-sm font-semibold ${
                    item.marker === 'future' ? 'text-neutral-400' : 'text-neutral-900'
                  }`}
                >
                  {item.title}
                </p>
                {(item.actor || item.description) && (
                  <p className="mt-0.5 text-body-sm text-neutral-500">
                    {item.actor ? `${item.actor} · ` : ''}
                    {item.description ? (
                      <span className="text-neutral-500">{item.description}</span>
                    ) : null}
                    {item.timestamp && (
                      <span className="text-neutral-400">{formatRefundDateTime(item.timestamp)}</span>
                    )}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card.Body>
    </Card>
  );
};
