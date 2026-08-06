import type { FC } from 'react';
import { PhoneCall } from 'lucide-react';
import { Card } from '../common/Card/Card';
import { DescriptionList } from '../common/DescriptionList/DescriptionList';
import { Icon } from '../common/Icon/Icon';
import type { DoctorResponse } from '../../types/doctor';

interface DoctorEmergencyCardProps {
  doctor: DoctorResponse;
}

/**
 * DoctorEmergencyCard — emergency contact details. Fields map 1:1 to
 * backend `DoctorResponse` (emergency_contact_name / phone).
 */
export const DoctorEmergencyCard: FC<DoctorEmergencyCardProps> = ({ doctor }) => {
  return (
    <Card>
      <Card.Header
        title="Emergency Contact"
        icon={<Icon icon={PhoneCall} size="md" className="text-danger" />}
      />
      <Card.Body>
        <DescriptionList
          layout="horizontal"
          columns={1}
          items={[
            { label: 'Contact Name', value: doctor.emergency_contact_name ?? '—' },
            { label: 'Contact Phone', value: doctor.emergency_contact_phone ?? '—' },
          ]}
        />
      </Card.Body>
    </Card>
  );
};
