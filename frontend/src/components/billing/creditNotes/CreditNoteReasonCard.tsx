import type { FC } from 'react';
import { Card } from '../../common/Card/Card';

interface CreditNoteReasonCardProps {
  reason: string;
}

export const CreditNoteReasonCard: FC<CreditNoteReasonCardProps> = ({ reason }) => {
  return (
    <Card variant="default" size="md">
      <Card.Header title="Reason" />
      <Card.Body>
        <p className="text-body text-neutral-700 whitespace-pre-wrap">{reason}</p>
      </Card.Body>
    </Card>
  );
};
