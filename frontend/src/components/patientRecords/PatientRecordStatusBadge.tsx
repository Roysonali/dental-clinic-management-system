import type { FC } from 'react';
import { StatusBadge } from '../common/StatusBadge/StatusBadge';
import {
  PATIENT_RECORD_STATUS_LABELS,
  PATIENT_RECORD_STATUS_VARIANTS,
} from '../../constants/patientRecord';
import type { RecordStatus } from '../../types/patientRecord';

interface PatientRecordStatusBadgeProps {
  status: RecordStatus;
  isFinalized?: boolean;
  size?: 'sm' | 'md';
}

/**
 * PatientRecordStatusBadge — status badge for patient records.
 *
 * Uses the approved mapping ([UI spec §1.2]): DRAFT neutral, IN_PROGRESS
 * info, UNDER_REVIEW warning, COMPLETED success, FINALIZED primary
 * (locked), LOCKED neutral. A finalized record always renders FINALIZED
 * even if the status string diverges (BCR O3) — the enum's terminal state.
 */
export const PatientRecordStatusBadge: FC<PatientRecordStatusBadgeProps> = ({
  status,
  isFinalized = false,
  size = 'sm',
}) => {
  const displayStatus: RecordStatus = isFinalized ? 'FINALIZED' : status;
  return (
    <StatusBadge
      status={displayStatus.toLowerCase()}
      label={PATIENT_RECORD_STATUS_LABELS[displayStatus]}
      statusMap={Object.fromEntries(
        Object.entries(PATIENT_RECORD_STATUS_VARIANTS).map(([key, value]) => [
          key.toLowerCase(),
          value,
        ]),
      )}
      size={size}
    />
  );
};
