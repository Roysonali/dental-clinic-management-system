import type { FC } from 'react';
import { ClipboardList } from 'lucide-react';
import { Card } from '../common/Card/Card';
import { Icon } from '../common/Icon/Icon';
import { EmptyState } from '../common/EmptyState/EmptyState';

/**
 * TreatmentSummaryCard — current treatment plan summary.
 *
 * The backend Treatment module is not yet wired to the frontend; this card is
 * an empty-state placeholder ready for `/treatment-plans/by-patient/{id}`.
 */
export const TreatmentSummaryCard: FC = () => {
  return (
    <Card>
      <Card.Header title="Current Treatment Plan" icon={<Icon icon={ClipboardList} size="md" className="text-info" />} />
      <Card.Body>
        <EmptyState
          title="No treatment plan"
          description="Active treatment plans for this patient will appear here."
        />
      </Card.Body>
    </Card>
  );
};
