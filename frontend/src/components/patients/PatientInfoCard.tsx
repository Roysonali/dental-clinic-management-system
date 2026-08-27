import type { FC } from 'react';
import { User, AlertTriangle } from 'lucide-react';
import { Card } from '../common/Card/Card';
import { DescriptionList } from '../common/DescriptionList/DescriptionList';
import { Icon } from '../common/Icon/Icon';
import { PatientStatusBadge } from './PatientStatusBadge';
import { PATIENT_GENDER_LABELS } from '../../constants/patient';
import { formatISODate } from '../../utils/date';
import type { PatientResponse } from '../../types/patient';

interface PatientInfoCardProps {
  patient: PatientResponse;
}

/**
 * PatientInfoCard — demographic + contact information for the Overview tab.
 */
export const PatientInfoCard: FC<PatientInfoCardProps> = ({ patient }) => {
  const genderLabel = patient.gender
    ? PATIENT_GENDER_LABELS[patient.gender as keyof typeof PATIENT_GENDER_LABELS] ?? patient.gender
    : null;

  return (
    <Card>
      <Card.Header
        title="Patient Information"
        icon={<Icon icon={User} size="md" className="text-primary-500" />}
      />
      <Card.Body>
        {patient.profile_status === 'incomplete' && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-warning/25 bg-warning/5 p-3">
            <Icon icon={AlertTriangle} size="sm" className="shrink-0 text-warning" />
            <span className="text-body-sm text-neutral-700">
              <span className="font-medium">Profile incomplete</span> —
              {' '}Date of birth and/or gender are missing.
              {' '}Complete the profile when the patient arrives.
            </span>
          </div>
        )}
        <DescriptionList
          layout="horizontal"
          columns={2}
          items={[
            { label: 'Patient Code', value: patient.patient_code },
            { label: 'Status', value: <PatientStatusBadge active={patient.is_active} /> },
            { label: 'Date of Birth', value: formatISODate(patient.date_of_birth) },
            { label: 'Age', value: patient.age ?? '—' },
            { label: 'Gender', value: genderLabel ?? '—' },
            { label: 'Phone', value: patient.primary_contact_number },
            { label: 'Emergency Contact', value: patient.emergency_contact_number ?? '—' },
            { label: 'Email', value: patient.email ?? '—' },
            { label: 'Address', value: patient.address ?? '—' },
          ]}
        />
      </Card.Body>
    </Card>
  );
};
