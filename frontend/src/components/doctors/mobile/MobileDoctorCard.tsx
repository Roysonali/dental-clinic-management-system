import type { FC } from 'react';
import { Phone } from 'lucide-react';
import { MobileCard } from '../../../layouts/components/mobile/MobileCard';
import { Icon } from '../../common/Icon/Icon';
import { Badge } from '../../common/Badge/Badge';
import { DoctorStatusBadge } from '../DoctorStatusBadge';
import { formatPhone } from '../../../utils/formatting';
import type { DoctorResponse } from '../../../types/doctor';

interface MobileDoctorCardProps {
  doctor: DoctorResponse;
  /** Navigates to the doctor detail page. */
  onClick?: () => void;
}

/** Availability pill — derived from the backend's live flags. */
function AvailabilityBadge({ doctor }: { doctor: DoctorResponse }) {
  if (doctor.on_leave) return <Badge variant="warning" size="sm">On leave</Badge>;
  if (doctor.available_for_appointment) return <Badge variant="success" size="sm">Available</Badge>;
  return <Badge variant="neutral" size="sm">Unavailable</Badge>;
}

/**
 * MobileDoctorCard — mobile presentation of a doctor row (reference card
 * language: code + status pill, bold name, muted qualification line,
 * divider, footer with phone + availability).
 */
export const MobileDoctorCard: FC<MobileDoctorCardProps> = ({ doctor, onClick }) => {
  const name = doctor.user_full_name ?? `Doctor #${doctor.id}`;
  const primarySpecialization =
    doctor.specializations.find((s) => s.is_primary)?.specialization_name ?? null;
  const secondary = [
    doctor.qualification ?? null,
    doctor.years_of_experience != null ? `${doctor.years_of_experience} yrs` : null,
    primarySpecialization ?? null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <MobileCard onClick={onClick} ariaLabel={`View ${name}`}>
      <span className="flex w-full items-center justify-between gap-3">
        <span className="min-w-0 truncate font-mono text-sm font-semibold tracking-tight text-neutral-900">
          {doctor.doctor_code}
        </span>
        <DoctorStatusBadge active={doctor.is_active} />
      </span>

      <span className="mt-3 block truncate text-lg font-semibold text-neutral-900">{name}</span>
      {secondary && (
        <span className="mt-1 block truncate text-sm text-neutral-500">{secondary}</span>
      )}

      <span className="my-4 block h-px w-full bg-neutral-100" />

      <span className="flex w-full items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-1.5 truncate text-sm text-neutral-500">
          <Icon icon={Phone} size="sm" className="shrink-0 text-neutral-400" />
          <span className="truncate">{formatPhone(doctor.primary_phone)}</span>
        </span>
        <span className="shrink-0">
          <AvailabilityBadge doctor={doctor} />
        </span>
      </span>
    </MobileCard>
  );
};
