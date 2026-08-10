import type { FC } from 'react';
import { Card } from '../../common/Card/Card';

interface PaymentNotesCardProps {
  notes: string | null;
}

/**
 * PaymentNotesCard — NOTES card (reference spec §32). Long notes wrap
 * naturally (no forced truncation) and can never cause horizontal overflow.
 */
export const PaymentNotesCard: FC<PaymentNotesCardProps> = ({ notes }) => {
  return (
    <Card>
      <Card.Body>
        <h3 className="text-h4 font-semibold text-neutral-900">Notes</h3>
        {notes ? (
          <p className="mt-3 whitespace-pre-wrap break-words text-body text-neutral-700">{notes}</p>
        ) : (
          <p className="mt-3 text-body text-neutral-400">No notes recorded.</p>
        )}
      </Card.Body>
    </Card>
  );
};
