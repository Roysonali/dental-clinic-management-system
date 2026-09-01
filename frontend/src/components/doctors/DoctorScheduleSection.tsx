import { useMemo, type FC } from 'react';
import { CalendarClock, Info, RotateCcw } from 'lucide-react';
import { Card } from '../common/Card/Card';
import { Icon } from '../common/Icon/Icon';
import { StatusBadge } from '../common/StatusBadge/StatusBadge';
import { Button } from '../common/Button/Button';
import {
  DOCTOR_DAY_LABELS,
  DOCTOR_ALL_DAYS,
  CLINIC_MORNING_LABEL,
  CLINIC_EVENING_LABEL,
} from '../../constants/doctor';
import { formatTime } from '../../utils/date';
import type { DoctorProfileResponse, ScheduleResponse, DayOfWeek } from '../../types/doctor';

interface DoctorScheduleSectionProps {
  doctor: DoctorProfileResponse;
  /** Whether the current user has admin role (controls edit visibility). */
  isAdmin?: boolean;
  /** Callback when the user clicks "Create Custom Schedule" or "Edit Schedule". */
  onEditSchedule?: () => void;
  /** Callback when the admin clicks "Revert to Clinic Default". */
  onRevertSchedule?: () => void;
}

/**
 * DoctorScheduleSection — enterprise-quality Working Schedule display.
 *
 * Handles two states:
 * 1. Zero custom schedules → "Using clinic default schedule" (Mon–Sat: 10–13, 17–21)
 * 2. One or more custom schedules → "Custom schedule" (all Mon–Sat, grouped by day)
 *
 * Multiple sessions per weekday are grouped under the same day.
 * Days without active sessions show "Not working".
 * Sunday is NOT displayed (not configurable).
 */
export const DoctorScheduleSection: FC<DoctorScheduleSectionProps> = ({
  doctor,
  isAdmin = false,
  onEditSchedule,
  onRevertSchedule,
}) => {
  const hasCustomSchedules = doctor.schedules.length > 0;

  // Group active schedules by day_of_week for the custom schedule view
  const groupedSchedules = useMemo(() => {
    if (!hasCustomSchedules) return {};

    const grouped: Partial<Record<DayOfWeek, ScheduleResponse[]>> = {};
    for (const schedule of doctor.schedules) {
      const day = schedule.day_of_week;
      if (!grouped[day]) grouped[day] = [];
      grouped[day]!.push(schedule);
    }
    // Sort sessions within each day by start_time
    for (const day of Object.keys(grouped) as unknown as DayOfWeek[]) {
      grouped[day]!.sort((a, b) => a.start_time.localeCompare(b.start_time));
    }
    return grouped;
  }, [doctor.schedules, hasCustomSchedules]);

  return (
    <Card>
      <Card.Header
        title="Working Schedule"
        icon={<Icon icon={CalendarClock} size="md" className="text-success" />}
        actions={
          isAdmin && onEditSchedule ? (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={onEditSchedule}
                data-testid="edit-schedule-button"
              >
                {hasCustomSchedules ? 'Edit Schedule' : 'Create Custom Schedule'}
              </Button>
              {hasCustomSchedules && onRevertSchedule && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRevertSchedule}
                  leftIcon={<Icon icon={RotateCcw} size="sm" />}
                  data-testid="revert-schedule-button"
                >
                  Revert to Clinic Default
                </Button>
              )}
            </div>
          ) : undefined
        }
      />
      <Card.Body>
        {/* Schedule type indicator */}
        <div className="mb-4 flex items-center gap-2 text-body-sm text-neutral-600">
          <Icon icon={Info} size="sm" className="text-primary-500" />
          <span>
            {hasCustomSchedules ? 'Custom schedule' : 'Using clinic default schedule'}
          </span>
        </div>

        {/* Schedule table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-body-sm">
            <caption className="sr-only">
              Weekly schedule for {doctor.user_full_name ?? doctor.doctor_code}
            </caption>
            <thead>
              <tr className="border-b border-neutral-200 text-caption text-neutral-500">
                <th scope="col" className="py-2 pr-4 font-medium">Day</th>
                <th scope="col" className="py-2 font-medium">Working Hours</th>
              </tr>
            </thead>
            <tbody>
              {DOCTOR_ALL_DAYS.map((day) => {
                const dayLabel = DOCTOR_DAY_LABELS[day];

                if (!hasCustomSchedules) {
                  // Clinic default: every Mon–Sat has the same sessions
                  return (
                    <tr key={day} className="border-b border-neutral-100 last:border-0">
                      <th scope="row" className="py-2.5 pr-4 font-medium text-neutral-900">
                        {dayLabel}
                      </th>
                      <td className="py-2.5">
                        <div className="flex flex-col gap-1">
                          <span className="tabular-nums text-neutral-700">{CLINIC_MORNING_LABEL}</span>
                          <span className="tabular-nums text-neutral-700">{CLINIC_EVENING_LABEL}</span>
                        </div>
                      </td>
                    </tr>
                  );
                }

                // Custom schedule: check if this day has active sessions
                const daySchedules = groupedSchedules[day] ?? [];
                const activeSessions = daySchedules.filter((s) => s.is_active);
                const inactiveSessions = daySchedules.filter((s) => !s.is_active);

                return (
                  <tr key={day} className="border-b border-neutral-100 last:border-0">
                    <th scope="row" className="py-2.5 pr-4 font-medium text-neutral-900">
                      {dayLabel}
                    </th>
                    <td className="py-2.5">
                      {activeSessions.length === 0 && inactiveSessions.length === 0 ? (
                        <span className="text-neutral-400 italic">Not working</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {activeSessions.map((s) => (
                            <span key={s.id} className="tabular-nums text-neutral-700">
                              {formatTime(s.start_time)} – {formatTime(s.end_time)}
                            </span>
                          ))}
                          {inactiveSessions.map((s) => (
                            <span key={s.id} className="tabular-nums text-neutral-400 line-through">
                              {formatTime(s.start_time)} – {formatTime(s.end_time)}
                              {' '}
                              <StatusBadge status="inactive" label="Inactive" size="sm" />
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card.Body>
    </Card>
  );
};
