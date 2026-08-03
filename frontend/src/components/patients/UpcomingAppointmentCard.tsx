import type { FC } from 'react';
import { CalendarClock } from 'lucide-react';
import { Card } from '../common/Card/Card';
import { Icon } from '../common/Icon/Icon';
import { EmptyState } from '../common/EmptyState/EmptyState';

/**
 * UpcomingAppointmentCard — next scheduled appointment.
 *
 * The backend Appointment module is not yet wired to the frontend; this card
 * is an empty-state placeholder ready for `/appointments?patient_id=...`.
 */
export const UpcomingAppointmentCard: FC = () => {
  return (
    <Card>
      <Card.Header title="Upcoming Appointment" icon={<Icon icon={CalendarClock} size="md" className="text-success" />} />
      <Card.Body>
        <EmptyState
          title="No upcoming appointments"
          description="Scheduled appointments for this patient will appear here."
        />
      </Card.Body>
    </Card>
  );
};
