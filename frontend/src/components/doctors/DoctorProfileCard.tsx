import type { FC } from 'react';
import { User } from 'lucide-react';
import { Card } from '../common/Card/Card';
import { DescriptionList } from '../common/DescriptionList/DescriptionList';
import { Icon } from '../common/Icon/Icon';
import { DoctorStatusBadge } from './DoctorStatusBadge';
import { DOCTOR_GENDER_LABELS } from '../../constants/doctor';
import { formatISODate } from '../../utils/date';
import type { DoctorResponse } from '../../types/doctor';

interface DoctorProfileCardProps {
  doctor: DoctorResponse;
}

/**
 * DoctorProfileCard — identity, demographics and contact information for
 * the Overview tab. Fields map 1:1 to backend `DoctorResponse` (no
 * invented information).
 */
export const DoctorProfileCard: FC<DoctorProfileCardProps> = ({ doctor }) => {
  const genderLabel = doctor.gender
    ? DOCTOR_GENDER_LABELS[doctor.gender as keyof typeof DOCTOR_GENDER_LABELS] ?? doctor.gender
    : null;

  return (
    <Card>
      <Card.Header
        title="Doctor Information"
        icon={<Icon icon={User} size="md" className="text-primary-500" />}
      />
      <Card.Body>
        <DescriptionList
          layout="horizontal"
          columns={2}
          items={[
            { label: 'Doctor Code', value: doctor.doctor_code },
            { label: 'Status', value: <DoctorStatusBadge active={doctor.is_active} /> },
            { label: 'Date of Birth', value: formatISODate(doctor.date_of_birth) },
            { label: 'Gender', value: genderLabel ?? '—' },
            { label: 'Primary Phone', value: doctor.primary_phone },
            { label: 'Email', value: doctor.user_email ?? '—' },
            { label: 'Address', value: doctor.address ?? '—' },
            { label: 'Registration Number', value: doctor.registration_number ?? '—' },
            {
              label: 'Languages',
              value: doctor.languages_known?.length ? doctor.languages_known.join(', ') : '—',
            },
          ]}
        />
      </Card.Body>
    </Card>
  );
};
