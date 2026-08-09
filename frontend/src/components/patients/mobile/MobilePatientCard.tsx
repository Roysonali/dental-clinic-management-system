import type { FC } from 'react';
import { Phone } from 'lucide-react';
import { MobileCard } from '../../../layouts/components/mobile/MobileCard';
import { Icon } from '../../common/Icon/Icon';
import { PatientStatusBadge } from '../PatientStatusBadge';
import { capitalize, formatPhone } from '../../../utils/formatting';
import type { PatientListItem } from '../../../types/patient';

interface MobilePatientCardProps {
  patient: PatientListItem;
  /** Navigates to the patient detail page. */
  onClick?: () => void;
}

/**
 * MobilePatientCard — mobile presentation of a patient row (same card
 * language as the billing reference cards: primary id + status pill on top,
 * bold name, muted secondary line, divider, footer pair).
 */
export const MobilePatientCard: FC<MobilePatientCardProps> = ({ patient, onClick }) => {
  const secondary = [
    patient.gender ? capitalize(patient.gender) : null,
    patient.age != null ? `${patient.age} yrs` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <MobileCard onClick={onClick} ariaLabel={`View ${patient.patient_code}`}>
      <span className="flex w-full items-center justify-between gap-3">
        <span className="min-w-0 truncate font-mono text-sm font-semibold tracking-tight text-neutral-900">
          {patient.patient_code}
        </span>
        <PatientStatusBadge active={patient.is_active} />
      </span>

      <span className="mt-3 block truncate text-lg font-semibold text-neutral-900">
        {patient.full_name}
      </span>
      {secondary && (
        <span className="mt-1 block truncate text-sm text-neutral-500">{secondary}</span>
      )}

      <span className="my-4 block h-px w-full bg-neutral-100" />

      <span className="flex w-full items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-1.5 truncate text-sm text-neutral-500">
          <Icon icon={Phone} size="sm" className="shrink-0 text-neutral-400" />
          <span className="truncate">{formatPhone(patient.primary_contact_number)}</span>
        </span>
        {patient.age != null && (
          <span className="shrink-0 text-sm font-medium text-neutral-700">{patient.age} yrs</span>
        )}
      </span>
    </MobileCard>
  );
};
