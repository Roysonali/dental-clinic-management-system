import type { FC } from 'react';
import { Stethoscope } from 'lucide-react';
import { Card } from '../common/Card/Card';
import { DescriptionList } from '../common/DescriptionList/DescriptionList';
import { Icon } from '../common/Icon/Icon';
import { DOCTOR_CURRENCY_CODE } from '../../constants/doctor';
import { formatCurrency } from '../../utils/formatting';
import type { DoctorResponse } from '../../types/doctor';

interface DoctorClinicalCardProps {
  doctor: DoctorResponse;
}

/**
 * DoctorClinicalCard — professional/clinical information (qualification,
 * experience, fee, consultation duration, biography). Fields map 1:1 to
 * backend `DoctorResponse`.
 */
export const DoctorClinicalCard: FC<DoctorClinicalCardProps> = ({ doctor }) => {
  return (
    <Card>
      <Card.Header
        title="Clinical Information"
        icon={<Icon icon={Stethoscope} size="md" className="text-info" />}
      />
      <Card.Body>
        <DescriptionList
          layout="horizontal"
          columns={2}
          items={[
            { label: 'Qualification', value: doctor.qualification ?? '—' },
            {
              label: 'Years of Experience',
              value: doctor.years_of_experience == null ? '—' : String(doctor.years_of_experience),
            },
            {
              label: 'Consultation Fee',
              value: formatCurrency(doctor.consultation_fee, DOCTOR_CURRENCY_CODE),
            },
            {
              label: 'Consultation Duration',
              value: doctor.consultation_duration == null ? '—' : `${doctor.consultation_duration} min`,
            },
          ]}
        />
        {doctor.biography && (
          <div className="mt-4 border-t border-neutral-100 pt-4">
            <span className="block text-caption font-medium text-neutral-500">Biography</span>
            <p className="mt-1 whitespace-pre-line text-body text-neutral-700">{doctor.biography}</p>
          </div>
        )}
      </Card.Body>
    </Card>
  );
};
