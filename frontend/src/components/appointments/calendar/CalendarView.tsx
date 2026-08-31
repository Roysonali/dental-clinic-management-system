import { useMemo, useState, useCallback, type FC } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useNavigate } from 'react-router-dom';
import { Spinner } from '../../common/Spinner/Spinner';
import { ResultState } from '../../common/ResultState/ResultState';
import { Button } from '../../common/Button/Button';
import { ROUTES } from '../../../routes/routes';
import { useAppointmentCalendar } from '../../../hooks/appointments/useAppointmentCalendar';
import { mapAppointmentsToEvents } from './calendarMapper';
import type { AppointmentStatus } from '../../../types/appointment';
import { apiErrorMessage } from '../../../services/apiError';

/**
 * Format a Date as YYYY-MM-DD using local (wall-clock) fields.
 * Avoids the UTC shift introduced by toISOString().
 */
function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface CalendarViewProps {
  /** Optional dentist ID filter */
  dentistId?: number | null;
  /** Optional status filter */
  statusFilter?: AppointmentStatus | 'all';
  /** Callback when an empty date/time is clicked (for creating appointments) */
  onDateClick?: (date: string, time?: string) => void;
}

/**
 * CalendarView — FullCalendar-based appointment calendar.
 *
 * Displays appointments in month/week/day views. Event click navigates
 * to the existing appointment details page. Empty date/time click
 * triggers the appointment creation flow via the parent container.
 *
 * Architecture:
 * - Owns visible date range state via useState (not useRef)
 * - Delegates data fetching to useAppointmentCalendar
 * - Maps API response to FullCalendar events via calendarMapper
 * - Navigates to existing appointment details on event click
 *
 * No drag/drop is enabled (Phase 1 = read-only).
 */
export const CalendarView: FC<CalendarViewProps> = ({
  dentistId = null,
  statusFilter = 'all',
  onDateClick,
}) => {
  const navigate = useNavigate();

  // Track the current visible date range via state (not ref)
  // so re-renders happen when the range changes
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: '',
  });

  const {
    data: calendarData,
    isLoading,
    isError,
    error,
    refetch,
  } = useAppointmentCalendar({
    start: dateRange.start,
    end: dateRange.end,
    dentist_id: dentistId ?? undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  });

  // Map API responses to FullCalendar events
  const events = useMemo(
    () => mapAppointmentsToEvents(calendarData?.items ?? []),
    [calendarData?.items],
  );

  // Handle date range changes from FullCalendar navigation
  const handleDatesSet = useCallback(
    (dateInfo: { startStr: string; end: Date; view: { type: string } }) => {
      // FullCalendar provides exclusive end dates for both dayGrid and timeGrid.
      // startStr is always "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM:SS" — slice to date.
      // For the end, use local Date methods to avoid UTC timezone shifts
      // that toISOString() would introduce (e.g., UTC+8 shifting Aug 1 → Jul 31).
      const startStr = dateInfo.startStr.slice(0, 10); // YYYY-MM-DD
      const endStr = formatLocalDate(dateInfo.end);

      // Only update if the range actually changed
      setDateRange((prev) => {
        if (prev.start === startStr && prev.end === endStr) return prev;
        return { start: startStr, end: endStr };
      });
    },
    [],
  );

  // Handle event click → navigate to existing appointment details
  const handleEventClick = useCallback(
    (clickInfo: { event: { id: string } }) => {
      const appointmentId = clickInfo.event.id;
      if (appointmentId) {
        navigate(`${ROUTES.APPOINTMENTS}/${appointmentId}?from=calendar`);
      }
    },
    [navigate],
  );

  // Handle empty date/time click → open create drawer
  const handleDateClickFn = useCallback(
    (dateClickInfo: { dateStr: string; allDay: boolean; date: Date }) => {
      if (!onDateClick) return;

      const dateStr = dateClickInfo.dateStr;
      if (dateClickInfo.allDay) {
        // Month view click → date only
        onDateClick(dateStr);
      } else {
        // Week/day view click → date + time
        const hours = dateClickInfo.date.getHours();
        const minutes = dateClickInfo.date.getMinutes();
        const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        onDateClick(dateStr, timeStr);
      }
    },
    [onDateClick],
  );

  // Loading state
  if (isLoading && !calendarData) {
    return (
      <div
        className="flex h-[600px] items-center justify-center rounded-xl border border-neutral-200 bg-white"
        role="status"
        aria-label="Loading calendar"
      >
        <Spinner size="lg" variant="primary" label="Loading calendar" />
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="rounded-xl border border-danger/20 bg-danger/5">
        <ResultState
          variant="error"
          title="Unable to load calendar"
          description={apiErrorMessage(error)}
          actions={
            <Button variant="primary" size="md" onClick={() => void refetch()}>
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="calendar-container rounded-xl border border-neutral-200 bg-white p-4">
      {/* FullCalendar overrides for DensCare design system */}
      <style>{`
        .calendar-container {
          /* Override FullCalendar CSS variables to match DensCare tokens */
          --fc-button-bg-color: white;
          --fc-button-border-color: #d1d5db;
          --fc-button-text-color: #374151;
          --fc-button-hover-bg-color: #f3f4f6;
          --fc-button-hover-border-color: #9ca3af;
          --fc-button-hover-text-color: #374151;
          --fc-button-active-bg-color: #2563eb;
          --fc-button-active-border-color: #2563eb;
          --fc-button-active-text-color: white;
        }
        .calendar-container .fc {
          font-family: inherit;
        }
        .calendar-container .fc-toolbar-title {
          font-size: 1.25rem;
          font-weight: 600;
          color: #111827;
        }
        .calendar-container .fc-button {
          background-color: white;
          border-color: #d1d5db;
          color: #374151;
          font-weight: 500;
          font-size: 0.875rem;
          padding: 0.375rem 0.75rem;
          border-radius: 0.5rem;
          text-transform: capitalize;
          transition: background-color 150ms, border-color 150ms, color 150ms, box-shadow 150ms;
        }
        .calendar-container .fc-button:hover {
          background-color: #f3f4f6 !important;
          border-color: #9ca3af !important;
          color: #374151 !important;
        }
        .calendar-container .fc-button:active,
        .calendar-container .fc-button.fc-button-active {
          background-color: #2563eb !important;
          border-color: #2563eb !important;
          color: white !important;
        }
        .calendar-container .fc-button:focus-visible {
          background-color: #f3f4f6 !important;
          border-color: #2563eb !important;
          color: #374151 !important;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.5);
          outline: none;
        }
        .calendar-container .fc-event {
          border-radius: 0.375rem;
          padding: 1px 4px;
          font-size: 0.8125rem;
          line-height: 1.4;
          cursor: pointer;
          border-width: 1px;
        }
        .calendar-container .fc-daygrid-day-number {
          padding: 0.5rem;
          font-size: 0.875rem;
          color: #374151;
        }
        .calendar-container .fc-col-header-cell-cushion {
          padding: 0.5rem;
          font-weight: 600;
          color: #6b7280;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .calendar-container .fc-timegrid-slot-label-cushion {
          font-size: 0.75rem;
          color: #9ca3af;
        }
        .calendar-container .fc-scrollgrid {
          border-color: #e5e7eb;
        }
        .calendar-container td, .calendar-container th {
          border-color: #e5e7eb;
        }
        .calendar-container .fc-day-today {
          background-color: #eff6ff !important;
        }
        .calendar-container .fc-event:hover {
          opacity: 0.9;
        }
      `}</style>

      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay',
        }}
        views={{
          dayGridMonth: {
            titleFormat: { year: 'numeric', month: 'long' },
          },
          timeGridWeek: {
            titleFormat: { year: 'numeric', month: 'short', day: 'numeric' },
            slotMinTime: '08:00:00',
            slotMaxTime: '22:00:00',
            allDaySlot: false,
          },
          timeGridDay: {
            titleFormat: { year: 'numeric', month: 'short', day: 'numeric' },
            slotMinTime: '08:00:00',
            slotMaxTime: '22:00:00',
            allDaySlot: false,
          },
        }}
        events={events}
        datesSet={handleDatesSet}
        eventClick={handleEventClick}
        dateClick={handleDateClickFn}
        height="auto"
        expandRows={true}
        nowIndicator={true}
        dayMaxEvents={3}
        moreLinkText={(n: number) => `+${n} more`}
        eventDisplay="block"
        editable={false}
        droppable={false}
      />
    </div>
  );
};
