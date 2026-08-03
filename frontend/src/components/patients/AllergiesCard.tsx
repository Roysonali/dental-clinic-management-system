import type { FC } from 'react';
import { Pill } from 'lucide-react';
import { Card } from '../common/Card/Card';
import { Icon } from '../common/Icon/Icon';
import { EmptyState } from '../common/EmptyState/EmptyState';

/**
 * AllergiesCard — drug allergies.
 *
 * The backend Patient module has no structured allergy entity; this card is
 * an empty-state placeholder ready to be wired to the Records module.
 */
export const AllergiesCard: FC = () => {
  return (
    <Card>
      <Card.Header title="Drug Allergies" icon={<Icon icon={Pill} size="md" className="text-danger" />} />
      <Card.Body>
        <EmptyState
          title="No allergies recorded"
          description="Allergies documented in clinical records will appear here."
        />
      </Card.Body>
    </Card>
  );
};
