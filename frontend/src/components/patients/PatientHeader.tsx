import type { FC, ReactNode } from 'react';
import { CalendarDays, Phone } from 'lucide-react';
import { PatientAvatar } from './PatientAvatar';
import { PatientStatusBadge } from './PatientStatusBadge';
import { Badge } from '../common/Badge/Badge';
import { Divider } from '../common/Divider/Divider';
import { PATIENT_GENDER_LABELS } from '../../constants/patient';
import { formatISODate } from '../../utils/date';
import type { PatientResponse } from '../../types/patient';

interface PatientHeaderProps {
  /** Full patient record */
  patient: PatientResponse;
  /** Actions rendered on the right (Edit, Deactivate/Reactivate) */
  actions?: ReactNode;
}

/**
 * PatientHeader — details-page hero: avatar, identity, code, lifecycle status,
 * key demographics, and action buttons.
 */
export const PatientHeader: FC<PatientHeaderProps> = ({ patient, actions }) => {
  const genderLabel = patient.gender
    ? PATIENT_GENDER_LABELS[patient.gender as keyof typeof PATIENT_GENDER_LABELS] ?? patient.gender
    : null;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        {/* Identity */}
        <div className="flex min-w-0 items-start gap-4">
          <PatientAvatar fullName={patient.full_name} size="xl" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-h2 font-semibold text-neutral-900">{patient.full_name}</h1>
              <PatientStatusBadge active={patient.is_active} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" size="sm">
                {patient.patient_code}
              </Badge>
            </div>
            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-body-sm text-neutral-600">
              <div className="flex items-center gap-1.5">
                <dt className="text-neutral-400">Age</dt>
                <dd className="font-medium text-neutral-800 tabular-nums">{patient.age ?? '—'}</dd>
              </div>
              <div className="flex items-center gap-1.5">
                <dt className="text-neutral-400">DOB</dt>
                <dd className="font-medium text-neutral-800">{formatISODate(patient.date_of_birth)}</dd>
              </div>
              {genderLabel && (
                <div className="flex items-center gap-1.5">
                  <dt className="text-neutral-400">Gender</dt>
                  <dd className="font-medium text-neutral-800">{genderLabel}</dd>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <dt className="flex items-center gap-1 text-neutral-400">
                  <Phone size={14} aria-hidden="true" />
                  <span className="sr-only">Phone</span>
                </dt>
                <dd className="font-medium text-neutral-800">{patient.primary_contact_number}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Actions */}
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>

      <Divider variant="subtle" className="my-4" />

      {/* Registered / last updated */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-caption text-neutral-500">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays size={14} aria-hidden="true" />
          Registered {formatISODate(patient.created_at)}
        </span>
        {patient.updated_at && (
          <span className="inline-flex items-center gap-1.5">
            Last updated {formatISODate(patient.updated_at)}
          </span>
        )}
      </div>
    </div>
  );
};
