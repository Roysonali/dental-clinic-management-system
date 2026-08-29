import { describe, it, expect } from 'vitest';
import {
  mapAppointmentToEvent,
  mapAppointmentsToEvents,
  getStatusColor,
} from './calendarMapper';
import type { CalendarAppointmentResponse } from '../../../types/appointment';

/** Factory for a minimal valid CalendarAppointmentResponse. */
function makeCalendarAppointment(
  overrides: Partial<CalendarAppointmentResponse> = {},
): CalendarAppointmentResponse {
  return {
    id: 'apt-001',
    appointment_number: 'APT-20260828-0001',
    patient_id: 'pat-001',
    patient_name: 'John Smith',
    dentist_id: 10,
    dentist_name: 'Dr. Sarah Johnson',
    appointment_date: '2026-08-28',
    start_time: '10:00:00',
    end_time: '10:30:00',
    duration_minutes: 30,
    appointment_type: 'Consultation',
    status: 'Scheduled',
    reason_for_visit: 'Annual checkup',
    ...overrides,
  };
}

describe('calendarMapper', () => {
  describe('mapAppointmentToEvent', () => {
    it('maps id correctly', () => {
      const apt = makeCalendarAppointment({ id: 'apt-abc' });
      const event = mapAppointmentToEvent(apt);
      expect(event.id).toBe('apt-abc');
    });

    it('maps title with patient name and formatted time', () => {
      const apt = makeCalendarAppointment({
        patient_name: 'Maria Cruz',
        start_time: '14:30:00',
      });
      const event = mapAppointmentToEvent(apt);
      expect(event.title).toBe('Maria Cruz · 2:30 PM');
    });

    it('maps start as naive local datetime', () => {
      const apt = makeCalendarAppointment({
        appointment_date: '2026-08-28',
        start_time: '10:00:00',
      });
      const event = mapAppointmentToEvent(apt);
      expect(event.start).toBe('2026-08-28T10:00:00');
    });

    it('maps end as naive local datetime', () => {
      const apt = makeCalendarAppointment({
        appointment_date: '2026-08-28',
        end_time: '11:00:00',
      });
      const event = mapAppointmentToEvent(apt);
      expect(event.end).toBe('2026-08-28T11:00:00');
    });

    it('does not append Z or timezone offset to datetime strings', () => {
      const apt = makeCalendarAppointment();
      const event = mapAppointmentToEvent(apt);
      expect(String(event.start)).not.toMatch(/Z$/);
      expect(String(event.end)).not.toMatch(/Z$/);
      expect(String(event.start)).not.toMatch(/[+-]\d{2}:\d{2}$/);
      expect(String(event.end)).not.toMatch(/[+-]\d{2}:\d{2}$/);
    });

    it('maps extendedProps with all expected fields', () => {
      const apt = makeCalendarAppointment({
        appointment_number: 'APT-20260828-0042',
        patient_id: 'pat-99',
        patient_name: 'Juan Dela Cruz',
        dentist_id: 5,
        dentist_name: 'Dr. Maria Reyes',
        appointment_type: 'Emergency',
        status: 'Confirmed',
        reason_for_visit: 'Toothache',
        duration_minutes: 45,
      });
      const event = mapAppointmentToEvent(apt);
      const props = event.extendedProps as Record<string, unknown>;

      expect(props.appointmentNumber).toBe('APT-20260828-0042');
      expect(props.patientId).toBe('pat-99');
      expect(props.patientName).toBe('Juan Dela Cruz');
      expect(props.dentistId).toBe(5);
      expect(props.dentistName).toBe('Dr. Maria Reyes');
      expect(props.appointmentType).toBe('Emergency');
      expect(props.status).toBe('Confirmed');
      expect(props.reasonForVisit).toBe('Toothache');
      expect(props.durationMinutes).toBe(45);
    });

    it('sets backgroundColor and borderColor from status color', () => {
      const apt = makeCalendarAppointment({ status: 'Scheduled' });
      const event = mapAppointmentToEvent(apt);
      expect(event.backgroundColor).toBe('#3B82F6');
      expect(event.borderColor).toBe('#3B82F6');
    });
  });

  describe('mapAppointmentsToEvents', () => {
    it('maps an empty array to an empty array', () => {
      expect(mapAppointmentsToEvents([])).toEqual([]);
    });

    it('maps multiple appointments', () => {
      const apts = [
        makeCalendarAppointment({ id: 'apt-1', patient_name: 'Alice' }),
        makeCalendarAppointment({ id: 'apt-2', patient_name: 'Bob' }),
        makeCalendarAppointment({ id: 'apt-3', patient_name: 'Carol' }),
      ];
      const events = mapAppointmentsToEvents(apts);
      expect(events).toHaveLength(3);
      expect(events[0].id).toBe('apt-1');
      expect(events[1].id).toBe('apt-2');
      expect(events[2].id).toBe('apt-3');
    });
  });

  describe('status colors', () => {
    it('returns correct color for each status', () => {
      expect(getStatusColor('Scheduled')).toBe('#3B82F6');
      expect(getStatusColor('Confirmed')).toBe('#F59E0B');
      expect(getStatusColor('Checked In')).toBe('#6366F1');
      expect(getStatusColor('In Treatment')).toBe('#8B5CF6');
      expect(getStatusColor('Completed')).toBe('#10B981');
      expect(getStatusColor('Cancelled')).toBe('#EF4444');
      expect(getStatusColor('No Show')).toBe('#6B7280');
    });

    it('returns fallback color for unknown status', () => {
      expect(getStatusColor('UnknownStatus')).toBe('#94A3B8');
    });
  });

  describe('event title formatting', () => {
    it('formats midnight time correctly', () => {
      const apt = makeCalendarAppointment({ start_time: '00:00:00' });
      const event = mapAppointmentToEvent(apt);
      expect(event.title).toContain('12:00 AM');
    });

    it('formats noon time correctly', () => {
      const apt = makeCalendarAppointment({ start_time: '12:00:00' });
      const event = mapAppointmentToEvent(apt);
      expect(event.title).toContain('12:00 PM');
    });

    it('formats 1:15 PM correctly', () => {
      const apt = makeCalendarAppointment({ start_time: '13:15:00' });
      const event = mapAppointmentToEvent(apt);
      expect(event.title).toContain('1:15 PM');
    });

    it('formats 9:00 AM correctly', () => {
      const apt = makeCalendarAppointment({ start_time: '09:00:00' });
      const event = mapAppointmentToEvent(apt);
      expect(event.title).toContain('9:00 AM');
    });
  });
});
