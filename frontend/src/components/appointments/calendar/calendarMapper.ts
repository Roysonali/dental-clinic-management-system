/* ============================================================
 * Calendar Mapper
 *
 * Converts DensCare CalendarAppointmentResponse objects into
 * FullCalendar EventInput objects.
 *
 * The mapper is the ONLY place in the codebase that knows about
 * FullCalendar's EventInput shape — all other code operates on
 * DensCare domain types.
 *
 * CRITICAL: appointment times represent clinic wall-clock time.
 * The mapper produces naive local strings (no "Z" suffix, no
 * timezone offset) so FullCalendar renders them as-is.
 * ============================================================ */

import type { EventInput } from '@fullcalendar/core';
import type { CalendarAppointmentResponse } from '../../../types/appointment';

/**
 * Build a FullCalendar EventInput from a single CalendarAppointmentResponse.
 *
 * The `start` and `end` fields are constructed as `YYYY-MM-DDTHH:MM:SS`
 * (local naive datetime) — FullCalendar interprets this as the browser's
 * local time by default when no timezone is configured, which matches the
 * clinic wall-clock semantics we need.
 */
export function mapAppointmentToEvent(
  appointment: CalendarAppointmentResponse,
): EventInput {
  // Build naive local datetime strings: "2026-08-28T10:00:00"
  const start = `${appointment.appointment_date}T${appointment.start_time}`;
  const end = `${appointment.appointment_date}T${appointment.end_time}`;

  return {
    id: appointment.id,
    title: buildEventTitle(appointment),
    start,
    end,
    backgroundColor: getEventColor(appointment.status),
    borderColor: getEventColor(appointment.status),
    extendedProps: {
      appointmentNumber: appointment.appointment_number,
      patientId: appointment.patient_id,
      patientName: appointment.patient_name,
      dentistId: appointment.dentist_id,
      dentistName: appointment.dentist_name,
      appointmentType: appointment.appointment_type,
      status: appointment.status,
      reasonForVisit: appointment.reason_for_visit,
      durationMinutes: appointment.duration_minutes,
    },
  };
}

/**
 * Map an array of calendar appointments to FullCalendar events.
 */
export function mapAppointmentsToEvents(
  appointments: CalendarAppointmentResponse[],
): EventInput[] {
  return appointments.map(mapAppointmentToEvent);
}

/**
 * Build the event title shown on calendar cells.
 *
 * Month view: "Patient Name" (compact)
 * Week/day view: "Patient Name · Type" (more detail)
 *
 * We use a single title for both — FullCalendar truncates as needed.
 * The popover/tooltip provides full details.
 */
function buildEventTitle(appointment: CalendarAppointmentResponse): string {
  const time = formatTimeShort(appointment.start_time);
  return `${appointment.patient_name} · ${time}`;
}

/**
 * Format HH:MM:SS as "h:mm AM/PM" for compact display.
 */
function formatTimeShort(time: string): string {
  const parts = time.split(':');
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  const ampm = h < 12 ? 'AM' : 'PM';
  return `${displayHour}:${String(m).padStart(2, '0')} ${ampm}`;
}

/**
 * Map appointment status to a background/border color.
 *
 * Colors are chosen for a healthcare enterprise context — restrained,
 * professional, and accessible against a white calendar background.
 *
 * These are CSS hex values, NOT Tailwind classes, because FullCalendar
 * accepts inline color values.
 */
function getEventColor(status: string): string {
  switch (status) {
    case 'Scheduled':
      return '#3B82F6'; // blue-500
    case 'Confirmed':
      return '#F59E0B'; // amber-500
    case 'Checked In':
      return '#6366F1'; // indigo-500
    case 'In Treatment':
      return '#8B5CF6'; // violet-500
    case 'Completed':
      return '#10B981'; // emerald-500
    case 'Cancelled':
      return '#EF4444'; // red-500
    case 'No Show':
      return '#6B7280'; // gray-500
    default:
      return '#94A3B8'; // slate-400 (fallback)
  }
}

/**
 * Get the status color for use in UI components (not FullCalendar).
 * Returns Tailwind-compatible CSS color values.
 */
export function getStatusColor(status: string): string {
  return getEventColor(status);
}
