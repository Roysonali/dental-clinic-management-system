import type { FC } from 'react';
import { Card } from '../../common/Card/Card';
import { formatReceiptDateTime } from '../../../utils/receiptFormatting';
import { buildReceiptAuditTimeline } from '../../../utils/receiptTimeline';
import type { ReceiptRead } from '../../../types/billing';

interface ReceiptAuditTrailCardProps {
  receipt: ReceiptRead;
}

/**
 * ReceiptAuditTrailCard — AUDIT TRAIL card (reference spec §9).
 *
 * Vertical timeline: circular markers (green fill for completed events),
 * connecting line, bold event titles, muted actor + timestamp. Events are
 * derived from the real receipt aggregate (see `buildReceiptAuditTimeline`
 * in utils/receiptTimeline).
 */
export const ReceiptAuditTrailCard: FC<ReceiptAuditTrailCardProps> = ({ receipt }) => {
  const items = buildReceiptAuditTimeline(receipt);

  return (
    <Card>
      <Card.Header title="Audit Trail" />
      <Card.Body>
        <div className="flex flex-col" role="list" aria-label="Receipt audit trail">
          {items.map((item, index) => (
            <div key={`${item.title}-${index}`} className="relative flex gap-4 pb-6 last:pb-0" role="listitem">
              <div className="flex flex-col items-center">
                <span
                  aria-hidden="true"
                  className={`mt-1 h-3 w-3 shrink-0 rounded-full border-2 ${
                    item.completed
                      ? 'border-success bg-success'
                      : 'border-neutral-300 bg-white'
                  }`}
                />
                {index < items.length - 1 && (
                  <span aria-hidden="true" className="mt-1 w-0.5 flex-1 bg-neutral-200" />
                )}
              </div>
              <div className="min-w-0 flex-1 pb-1">
                <p className="text-body-sm font-semibold text-neutral-900">{item.title}</p>
                <p className="mt-0.5 text-body-sm text-neutral-500">
                  {item.actor ? `${item.actor} · ` : ''}
                  <span className="text-neutral-400">{formatReceiptDateTime(item.timestamp)}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card.Body>
    </Card>
  );
};
