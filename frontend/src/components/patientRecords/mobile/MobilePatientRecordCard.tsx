import type { FC } from 'react';
import { MobileCard } from '../../../layouts/components/mobile/MobileCard';
import { Badge } from '../../common/Badge/Badge';
import { PatientRecordStatusBadge } from '../PatientRecordStatusBadge';
import { formatISODate } from '../../../utils/date';
import type { EnrichedPatientRecord } from '../../../types/patientRecord';

interface MobilePatientRecordCardProps {
  record: EnrichedPatientRecord;
  /** Navigates to the record detail page. */
  onClick?: () => void;
}

/**
 * MobilePatientRecordCard — mobile presentation of a patient record row
 * (reference card language: appointment id + status pill, bold patient,
 * muted chief complaint, divider, footer with created date + finalized
 * indicator).
 */
export const MobilePatientRecordCard: FC<MobilePatientRecordCardProps> = ({ record, onClick }) => {
  const patientName = record.patient_name ?? `Patient #${record.patient_id}`;
  const appointmentLabel = record.has_appointment
    ? (record.appointment_number ?? `APT #${record.appointment_id?.slice(0, 8)}`)
    : '—';

  return (
    <MobileCard onClick={onClick} ariaLabel={`View record for ${patientName}`}>
      <span className="flex w-full items-center justify-between gap-3">
        <span className="min-w-0 truncate font-mono text-sm font-semibold tracking-tight text-neutral-900">
          {appointmentLabel}
        </span>
        <PatientRecordStatusBadge status={record.status} isFinalized={record.is_finalized} />
      </span>

      <span className="mt-3 block truncate text-lg font-semibold text-neutral-900">
        {patientName}
      </span>
      <span className="mt-1 block truncate text-sm text-neutral-500">
        {record.chief_complaint || 'No chief complaint recorded'}
      </span>

      <span className="my-4 block h-px w-full bg-neutral-100" />

      <span className="flex w-full items-center justify-between gap-3">
        <span className="min-w-0 truncate text-sm text-neutral-500">
          Created {formatISODate(record.created_at)}
        </span>
        {record.is_finalized ? (
          <Badge variant="primary" size="sm" className="shrink-0">
            Finalized
          </Badge>
        ) : null}
      </span>
    </MobileCard>
  );
};
