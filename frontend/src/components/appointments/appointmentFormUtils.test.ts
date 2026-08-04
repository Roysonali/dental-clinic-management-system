import { describe, it, expect } from 'vitest';
import {
  toTimePickerFormat,
  toBackendTime,
  appointmentToFormValues,
  formValuesToCreatePayload,
  formValuesToUpdatePayload,
} from './appointmentFormUtils';
import type {
  AppointmentFormValues,
  AppointmentResponse,
} from '../../types/appointment';

const appointment: AppointmentResponse = {
  id: 'a1',
  appointment_number: 'APT-20260707-0001',
  patient_id: 'p1',
  dentist_id: 3,
  appointment_date: '2026-07-08',
  start_time: '10:00:00',
  end_time: '10:30:00',
  duration_minutes: 30,
  appointment_type: 'Consultation',
  status: 'Scheduled',
  reason_for_visit: 'Toothache',
  notes: 'Call ahead',
  created_by: 1,
  updated_by: null,
  created_at: '2026-07-07T08:00:00Z',
  updated_at: '2026-07-07T08:00:00Z',
};

const formValues: AppointmentFormValues = {
  patient_id: 'p1',
  dentist_id: '3',
  appointment_date: '2026-07-08',
  start_time: '10:00',
  duration_minutes: '30',
  appointment_type: 'Consultation',
  reason_for_visit: '  Toothache  ',
  notes: '  Call ahead  ',
};

describe('appointmentFormUtils', () => {
  describe('time helpers', () => {
    it('converts backend HH:MM:SS to TimePicker HH:MM', () => {
      expect(toTimePickerFormat('14:05:00')).toBe('14:05');
    });

    it('converts TimePicker HH:MM back to backend HH:MM:SS', () => {
      expect(toBackendTime('14:05')).toBe('14:05:00');
    });
  });

  describe('appointmentToFormValues', () => {
    it('maps an API appointment onto form values', () => {
      const values = appointmentToFormValues(appointment);
      expect(values).toEqual({
        patient_id: 'p1',
        dentist_id: '3',
        appointment_date: '2026-07-08',
        start_time: '10:00',
        duration_minutes: '30',
        appointment_type: 'Consultation',
        reason_for_visit: 'Toothache',
        notes: 'Call ahead',
      });
    });

    it('maps null notes to an empty string', () => {
      const values = appointmentToFormValues({ ...appointment, notes: null });
      expect(values.notes).toBe('');
    });
  });

  describe('formValuesToCreatePayload', () => {
    it('converts strings to backend types and trims text', () => {
      const payload = formValuesToCreatePayload(formValues);
      expect(payload).toEqual({
        patient_id: 'p1',
        dentist_id: 3,
        appointment_date: '2026-07-08',
        start_time: '10:00:00',
        duration_minutes: 30,
        appointment_type: 'Consultation',
        reason_for_visit: 'Toothache',
        notes: 'Call ahead',
      });
    });

    it('sends null (not empty string) when notes are blank', () => {
      const payload = formValuesToCreatePayload({ ...formValues, notes: '   ' });
      expect(payload.notes).toBeNull();
    });
  });

  describe('formValuesToUpdatePayload', () => {
    it('omits patient_id (not editable by the backend update schema)', () => {
      const payload = formValuesToUpdatePayload(formValues);
      expect('patient_id' in payload).toBe(false);
      expect(payload.dentist_id).toBe(3);
      expect(payload.start_time).toBe('10:00:00');
    });
  });
});
