import type { FC } from 'react';
import type { AppointmentStatus } from '../../../types/appointment';
import { getStatusColor } from './calendarMapper';

/**
 * CalendarLegend — visual legend showing status-to-color mapping.
 *
 * Ensures accessibility by providing text labels alongside color indicators.
 * Status is not communicated by color alone — each status has its label
 * displayed next to the color swatch.
 */
export const CalendarLegend: FC = () => {
  const statuses: AppointmentStatus[] = [
    'Scheduled',
    'Confirmed',
    'Checked In',
    'In Treatment',
    'Completed',
    'Cancelled',
    'No Show',
  ];

  return (
    <div
      className="flex flex-wrap items-center gap-3"
      role="group"
      aria-label="Appointment status legend"
    >
      {statuses.map((status) => (
        <div
          key={status}
          className="flex items-center gap-1.5 text-caption text-neutral-600"
        >
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: getStatusColor(status) }}
            aria-hidden="true"
          />
          <span>{status}</span>
        </div>
      ))}
    </div>
  );
};
