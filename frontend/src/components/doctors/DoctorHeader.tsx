import type { FC, ReactNode } from 'react';
import { CalendarDays, Phone } from 'lucide-react';
import { DoctorAvatar } from './DoctorAvatar';
import { DoctorStatusBadge } from './DoctorStatusBadge';
import { Badge } from '../common/Badge/Badge';
import { StatusBadge } from '../common/StatusBadge/StatusBadge';
import { Divider } from '../common/Divider/Divider';
import { DOCTOR_GENDER_LABELS } from '../../constants/doctor';
import { formatISODate } from '../../utils/date';
import type { DoctorProfileResponse } from '../../types/doctor';

interface DoctorHeaderProps {
  /** Full doctor profile (profile endpoint includes schedules + specializations) */
  doctor: DoctorProfileResponse;
  /** Actions rendered on the right (Edit, Activate/Deactivate, toggles) */
  actions?: ReactNode;
}

/**
 * DoctorHeader — details-page hero: avatar, identity, code, lifecycle
 * status, availability and leave flags, key demographics, and actions.
 *
 * Badges map 1:1 to backend flags: `is_active` (DoctorStatusBadge),
 * `available_for_appointment`, and `on_leave`.
 */
export const DoctorHeader: FC<DoctorHeaderProps> = ({ doctor, actions }) => {
  const genderLabel = doctor.gender
    ? DOCTOR_GENDER_LABELS[doctor.gender as keyof typeof DOCTOR_GENDER_LABELS] ?? doctor.gender
    : null;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        {/* Identity */}
        <div className="flex min-w-0 items-start gap-4">
          <DoctorAvatar
            fullName={doctor.user_full_name}
            src={doctor.profile_photo_url}
            size="xl"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-h1 font-semibold tracking-tight text-neutral-900">
                {doctor.user_full_name ?? `Doctor #${doctor.user_id}`}
              </h1>
              <DoctorStatusBadge active={doctor.is_active} />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" size="sm">
                {doctor.doctor_code}
              </Badge>
              {/* NOTE: these badges reflect the RAW backend flags
                  (available_for_appointment / on_leave) — the exact values
                  the header toggles operate on. The list table instead shows
                  the computed availability (is_active AND flag AND NOT
                  on_leave), so a doctor on leave can read "Available" here
                  but "Unavailable" in the list — intentional. */}
              <StatusBadge
                status={doctor.available_for_appointment ? 'available' : 'unavailable'}
                label={doctor.available_for_appointment ? 'Available' : 'Unavailable'}
                statusMap={{ available: 'success', unavailable: 'neutral' }}
                size="sm"
                showDot
              />
              <StatusBadge
                status={doctor.on_leave ? 'on-leave' : 'on-duty'}
                label={doctor.on_leave ? 'On Leave' : 'On Duty'}
                statusMap={{ 'on-leave': 'warning', 'on-duty': 'success' }}
                size="sm"
                showDot
              />
            </div>
            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-body-sm text-neutral-600">
              <div className="flex items-center gap-1.5">
                <dt className="text-neutral-400">DOB</dt>
                <dd className="font-medium text-neutral-800">{formatISODate(doctor.date_of_birth)}</dd>
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
                <dd className="font-medium text-neutral-800">{doctor.primary_phone}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Actions */}
        {actions && (
          <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            {actions}
          </div>
        )}
      </div>

      <Divider variant="subtle" className="my-4" />

      {/* Registered / last updated */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-caption text-neutral-500">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays size={14} aria-hidden="true" />
          Registered {formatISODate(doctor.created_at)}
        </span>
        {doctor.updated_at && (
          <span className="inline-flex items-center gap-1.5">
            Last updated {formatISODate(doctor.updated_at)}
          </span>
        )}
      </div>
    </div>
  );
};
