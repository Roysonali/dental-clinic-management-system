import type { FC } from 'react';
import { Card } from '../../common/Card/Card';

interface RefundReasonCardProps {
  reason: string;
}

/**
 * RefundReasonCard — right-column REASON card (reference spec §21).
 * Normal readable body text — deliberately not a highlighted alert.
 */
export const RefundReasonCard: FC<RefundReasonCardProps> = ({ reason }) => {
  return (
    <Card>
      <Card.Header title="Reason" />
      <Card.Body>
        <p className="whitespace-pre-wrap text-body text-neutral-700">{reason}</p>
      </Card.Body>
    </Card>
  );
};
