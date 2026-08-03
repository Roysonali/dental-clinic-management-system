import type { FC } from 'react';
import { Stethoscope } from 'lucide-react';
import { Card } from '../common/Card/Card';
import { Icon } from '../common/Icon/Icon';
import { EmptyState } from '../common/EmptyState/EmptyState';
import type { PatientResponse } from '../../types/patient';

interface ClinicalSummaryCardProps {
  patient: PatientResponse;
}

/**
 * ClinicalSummaryCard — clinical notes from the patient's `remarks` field.
 * (The backend Patient module has no dedicated clinical summary entity, so
 * the free-text remarks field is the source of truth for the overview.)
 */
export const ClinicalSummaryCard: FC<ClinicalSummaryCardProps> = ({ patient }) => {
  return (
    <Card>
      <Card.Header
        title="Clinical Summary"
        icon={<Icon icon={Stethoscope} size="md" className="text-info" />}
      />
      <Card.Body>
        {patient.remarks ? (
          <p className="whitespace-pre-wrap text-body text-neutral-700">{patient.remarks}</p>
        ) : (
          <EmptyState
            title="No clinical notes"
            description="Remarks added to this patient will appear here."
          />
        )}
      </Card.Body>
    </Card>
  );
};
