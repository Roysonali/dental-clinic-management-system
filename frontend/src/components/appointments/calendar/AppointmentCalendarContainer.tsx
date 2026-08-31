import { useState, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarView } from './CalendarView';
import { CalendarFilters } from './CalendarFilters';
import { CalendarLegend } from './CalendarLegend';
import { AppointmentFormContainer } from '../containers/AppointmentFormContainer';
import type {
  AppointmentResponse,
  AppointmentFormValues,
} from '../../../types/appointment';
import type { AppointmentStatusFilter } from '../../../constants/appointment';

/**
 * AppointmentCalendarContainer — orchestrates the appointment calendar page.
 *
 * Owns:
 * - Dentist filter state
 * - Status filter state
 * - Create-appointment drawer state (reuses existing AppointmentFormContainer)
 *
 * The CalendarView handles its own date range via FullCalendar's datesSet.
 * Filters trigger a new API fetch via the query key changes.
 *
 * Architecture: this is a sibling to AppointmentListContainer — both are
 * views of the same Appointment domain. No business logic is duplicated.
 */
export const AppointmentCalendarContainer: FC = () => {
  const navigate = useNavigate();

  // Filter state
  const [dentistId, setDentistId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<AppointmentStatusFilter>('all');

  // Create drawer state
  const [createOpen, setCreateOpen] = useState(false);
  const [prefillDate, setPrefillDate] = useState<string | null>(null);
  const [prefillTime, setPrefillTime] = useState<string | null>(null);

  // Handle date/time click from calendar → open create drawer with prefilled values
  const handleDateClick = (date: string, time?: string) => {
    setPrefillDate(date);
    setPrefillTime(time ?? null);
    setCreateOpen(true);
  };

  // Close create drawer and clear prefill state
  const handleCloseCreate = () => {
    setCreateOpen(false);
    setPrefillDate(null);
    setPrefillTime(null);
  };

  // After successful creation, navigate to the new appointment (with calendar context)
  const handleCreated = (appointment: AppointmentResponse) => {
    handleCloseCreate();
    navigate(`/appointments/${appointment.id}?from=calendar`);
  };

  // Build initial values for the create form
  const createInitialValues: Partial<AppointmentFormValues> | undefined = (() => {
    const values: Partial<AppointmentFormValues> = {};
    if (prefillDate) values.appointment_date = prefillDate;
    if (prefillTime) values.start_time = prefillTime;
    return Object.keys(values).length > 0 ? values : undefined;
  })();

  return (
    <div className="flex flex-col gap-4">
      {/* Filters toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CalendarFilters
          dentistId={dentistId}
          onDentistChange={setDentistId}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
        />
        <CalendarLegend />
      </div>

      {/* Calendar */}
      <CalendarView
        dentistId={dentistId}
        statusFilter={statusFilter}
        onDateClick={handleDateClick}
      />

      {/* Create appointment drawer (reuses existing AppointmentFormContainer) */}
      <AppointmentFormContainer
        open={createOpen}
        mode="create"
        onClose={handleCloseCreate}
        onCreated={handleCreated}
        initialFormValues={createInitialValues}
      />
    </div>
  );
};
