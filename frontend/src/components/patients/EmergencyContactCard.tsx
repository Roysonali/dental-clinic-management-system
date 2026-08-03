import type { FC } from 'react';
import { PhoneCall } from 'lucide-react';
import { Card } from '../common/Card/Card';
import { DescriptionList } from '../common/DescriptionList/DescriptionList';
import { Icon } from '../common/Icon/Icon';
import type { PatientResponse } from '../../types/patient';

interface EmergencyContactCardProps {
  patient: PatientResponse;
}

/**
 * EmergencyContactCard — emergency contact details for the Overview tab.
 */
export const EmergencyContactCard: FC<EmergencyContactCardProps> = ({ patient }) => {
  return (
    <Card>
      <Card.Header
        title="Emergency Contact"
        icon={<Icon icon={PhoneCall} size="md" className="text-danger" />}
      />
      <Card.Body>
        <DescriptionList
          items={[
            {
              label: 'Contact Number',
              value: patient.emergency_contact_number ?? (
                <span className="text-neutral-400">Not provided</span>
              ),
            },
          ]}
        />
      </Card.Body>
    </Card>
  );
};
