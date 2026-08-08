import type { FC } from 'react';
import { Card } from '../../common/Card/Card';
import type { InvoiceRead } from '../../../types/billing';

interface InvoiceNotesCardProps {
  invoice: InvoiceRead;
}

/**
 * InvoiceNotesCard — dedicated notes card for the invoice detail.
 *
 * Long text wraps naturally (no truncation of financial/clinical notes).
 * Also surfaces cancellation / void reasons when the backend provides them.
 */
export const InvoiceNotesCard: FC<InvoiceNotesCardProps> = ({ invoice }) => {
  const hasNotes = Boolean(invoice.notes);
  const hasCancellation = Boolean(invoice.cancellation_reason);
  const hasVoid = Boolean(invoice.void_reason);

  if (!hasNotes && !hasCancellation && !hasVoid) {
    return (
      <Card>
        <Card.Body>
          <h3 className="text-h4 font-semibold text-neutral-900">Notes</h3>
          <p className="mt-3 text-body text-neutral-400">No notes for this invoice.</p>
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card>
      <Card.Body>
        <h3 className="text-h4 font-semibold text-neutral-900">Notes</h3>
        <div className="mt-3 space-y-4">
          {invoice.notes && (
            <p className="whitespace-pre-wrap text-body text-neutral-700">{invoice.notes}</p>
          )}
          {invoice.cancellation_reason && (
            <div>
              <p className="text-caption font-semibold uppercase tracking-wide text-danger">
                Cancellation reason
              </p>
              <p className="mt-1 whitespace-pre-wrap text-body text-neutral-700">
                {invoice.cancellation_reason}
              </p>
            </div>
          )}
          {invoice.void_reason && (
            <div>
              <p className="text-caption font-semibold uppercase tracking-wide text-neutral-500">
                Void reason
              </p>
              <p className="mt-1 whitespace-pre-wrap text-body text-neutral-700">
                {invoice.void_reason}
              </p>
            </div>
          )}
        </div>
      </Card.Body>
    </Card>
  );
};
