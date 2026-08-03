import type { FC } from 'react';
import { UserPlus, Pencil } from 'lucide-react';
import { Timeline } from '../common/Timeline/Timeline';
import type { PatientResponse } from '../../types/patient';
import { formatISODate } from '../../utils/date';

interface ActivityTimelineProps {
  patient: PatientResponse;
}

/**
 * ActivityTimeline — recent activity for a patient.
 *
 * Built from the patient audit fields (created_at / updated_at). The backend
 * exposes no dedicated activity log for patients; when the audit module is
 * wired, richer entries can be appended here.
 */
export const ActivityTimeline: FC<ActivityTimelineProps> = ({ patient }) => {
  const items = [
    {
      icon: UserPlus,
      iconColor: 'border-primary-200 text-primary-500',
      title: 'Patient registered',
      description: `Registered with code ${patient.patient_code}`,
      timestamp: formatISODate(patient.created_at),
    },
  ];

  if (patient.updated_at && patient.updated_at !== patient.created_at) {
    items.push({
      icon: Pencil,
      iconColor: 'border-neutral-200 text-neutral-500',
      title: 'Record updated',
      description: 'Patient details were last modified',
      timestamp: formatISODate(patient.updated_at),
    });
  }

  return <Timeline items={items} />;
};
