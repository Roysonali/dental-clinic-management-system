import type { FC } from 'react';
import { CalendarClock } from 'lucide-react';
import { Card } from '../common/Card/Card';
import { Icon } from '../common/Icon/Icon';
import { StatusBadge } from '../common/StatusBadge/StatusBadge';
import { EmptyState } from '../common/EmptyState/EmptyState';
import { DOCTOR_DAY_LABELS } from '../../constants/doctor';
import { formatTime } from '../../utils/date';
import type { DoctorProfileResponse } from '../../types/doctor';

interface DoctorScheduleSectionProps {
  doctor: DoctorProfileResponse;
}

/**
 * DoctorScheduleSection — read-only weekly schedule template (Monday
 * through Saturday) from the profile endpoint. No add/edit/delete or
 * replace-week UI (schedule management belongs to a later phase).
 *
 * Rendered as a semantic table with proper column headers and scope
 * attributes for screen readers.
 */
export const DoctorScheduleSection: FC<DoctorScheduleSectionProps> = ({ doctor }) => {
  // Backend returns schedules ordered by day_of_week; sort defensively so
  // display is always Monday→Saturday regardless of API ordering.
  const schedules = [...doctor.schedules].sort((a, b) => a.day_of_week - b.day_of_week);

  return (
    <Card>
      <Card.Header
        title="Weekly Schedule"
        icon={<Icon icon={CalendarClock} size="md" className="text-success" />}
      />
      <Card.Body>
        {schedules.length === 0 ? (
          <EmptyState
            title="No schedule set"
            description="This doctor's weekly schedule will appear here once set."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-body-sm">
              <caption className="sr-only">
                Weekly schedule for {doctor.user_full_name ?? doctor.doctor_code}
              </caption>
              <thead>
                <tr className="border-b border-neutral-200 text-caption text-neutral-500">
                  <th scope="col" className="py-2 pr-4 font-medium">Day</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Start Time</th>
                  <th scope="col" className="py-2 pr-4 font-medium">End Time</th>
                  <th scope="col" className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((schedule) => (
                  <tr key={schedule.id} className="border-b border-neutral-100 last:border-0">
                    <th scope="row" className="py-2.5 pr-4 font-medium text-neutral-900">
                      {DOCTOR_DAY_LABELS[schedule.day_of_week]}
                    </th>
                    <td className="py-2.5 pr-4 tabular-nums text-neutral-700">
                      {formatTime(schedule.start_time)}
                    </td>
                    <td className="py-2.5 pr-4 tabular-nums text-neutral-700">
                      {formatTime(schedule.end_time)}
                    </td>
                    <td className="py-2.5">
                      <StatusBadge
                        status={schedule.is_active ? 'active' : 'inactive'}
                        label={schedule.is_active ? 'Active' : 'Inactive'}
                        size="sm"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card.Body>
    </Card>
  );
};
