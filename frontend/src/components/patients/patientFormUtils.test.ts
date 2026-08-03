import { describe, it, expect } from 'vitest';
import {
  patientToFormValues,
  formValuesToCreatePayload,
  formValuesToUpdatePayload,
} from './patientFormUtils';
import type { PatientFormValues, PatientResponse } from '../../types/patient';

const patient: PatientResponse = {
  id: 'p1',
  patient_code: 'PAT-000001',
  full_name: 'Juan Dela Cruz',
  date_of_birth: '1990-05-15',
  age: 34,
  gender: 'male',
  primary_contact_number: '+639123456789',
  emergency_contact_number: '+639987654321',
  email: 'JUAN@EXAMPLE.COM',
  address: '123 Rizal St.',
  remarks: 'Allergic to penicillin.',
  is_active: true,
  created_by: 1,
  updated_by: 1,
  created_at: '2025-01-15T10:30:00Z',
  updated_at: '2025-06-20T14:45:00Z',
};

const formValues: PatientFormValues = {
  first_name: ' Juan ',
  middle_name: ' Reyes ',
  last_name: ' Dela Cruz ',
  date_of_birth: '1990-05-15',
  gender: 'male',
  primary_contact_number: ' +639123456789 ',
  emergency_contact_number: ' +639987654321 ',
  email: ' JUAN@EXAMPLE.COM ',
  address: ' 123 Rizal St. ',
  remarks: ' Allergic to penicillin. ',
};

describe('patientToFormValues', () => {
  it('maps a full patient response into editable form values', () => {
    expect(patientToFormValues(patient)).toEqual({
      date_of_birth: '1990-05-15',
      gender: 'male',
      primary_contact_number: '+639123456789',
      emergency_contact_number: '+639987654321',
      email: 'JUAN@EXAMPLE.COM',
      address: '123 Rizal St.',
      remarks: 'Allergic to penicillin.',
    });
  });

  it('normalizes null optional fields to empty strings for the form', () => {
    const sparse: PatientResponse = {
      ...patient,
      gender: null,
      emergency_contact_number: null,
      email: null,
      address: null,
      remarks: null,
    };

    expect(patientToFormValues(sparse)).toEqual({
      date_of_birth: '1990-05-15',
      gender: '',
      primary_contact_number: '+639123456789',
      emergency_contact_number: '',
      email: '',
      address: '',
      remarks: '',
    });
  });

  it('passes through the ISO date_of_birth unchanged', () => {
    expect(patientToFormValues(patient).date_of_birth).toBe('1990-05-15');
  });
});

describe('formValuesToCreatePayload', () => {
  it('trims required names and contact number', () => {
    const payload = formValuesToCreatePayload(formValues);
    expect(payload.first_name).toBe('Juan');
    expect(payload.last_name).toBe('Dela Cruz');
    expect(payload.primary_contact_number).toBe('+639123456789');
  });

  it('keeps populated optional fields and lowercases the email', () => {
    const payload = formValuesToCreatePayload(formValues);
    expect(payload.middle_name).toBe('Reyes');
    expect(payload.emergency_contact_number).toBe('+639987654321');
    expect(payload.email).toBe('juan@example.com');
    expect(payload.address).toBe('123 Rizal St.');
    expect(payload.remarks).toBe('Allergic to penicillin.');
  });

  it('converts empty/whitespace optional fields to null for POST', () => {
    const empty: PatientFormValues = {
      ...formValues,
      middle_name: '   ',
      emergency_contact_number: '',
      email: '',
      address: ' ',
      remarks: '',
    };

    const payload = formValuesToCreatePayload(empty);
    expect(payload.middle_name).toBeNull();
    expect(payload.emergency_contact_number).toBeNull();
    expect(payload.email).toBeNull();
    expect(payload.address).toBeNull();
    expect(payload.remarks).toBeNull();
  });

  it('passes the date_of_birth through untouched', () => {
    expect(formValuesToCreatePayload(formValues).date_of_birth).toBe('1990-05-15');
  });
});

describe('formValuesToUpdatePayload (PATCH exclude_none compatibility)', () => {
  it('always sends required fields (names, DOB, gender, primary contact)', () => {
    const payload = formValuesToUpdatePayload(formValues);
    expect(payload).toEqual(
      expect.objectContaining({
        first_name: 'Juan',
        last_name: 'Dela Cruz',
        date_of_birth: '1990-05-15',
        gender: 'male',
        primary_contact_number: '+639123456789',
      }),
    );
  });

  it('includes populated optional fields and lowercases the email', () => {
    const payload = formValuesToUpdatePayload(formValues);
    expect(payload.middle_name).toBe('Reyes');
    expect(payload.emergency_contact_number).toBe('+639987654321');
    expect(payload.email).toBe('juan@example.com');
    expect(payload.address).toBe('123 Rizal St.');
    expect(payload.remarks).toBe('Allergic to penicillin.');
  });

  it('omits empty optional fields entirely (never sends empty strings)', () => {
    const empty: PatientFormValues = {
      ...formValues,
      middle_name: '',
      emergency_contact_number: '   ',
      email: '',
      address: ' ',
      remarks: '',
    };

    const payload = formValuesToUpdatePayload(empty);
    expect(payload).not.toHaveProperty('middle_name');
    expect(payload).not.toHaveProperty('emergency_contact_number');
    expect(payload).not.toHaveProperty('email');
    expect(payload).not.toHaveProperty('address');
    expect(payload).not.toHaveProperty('remarks');
  });

  it('keeps required fields even when optionals are omitted', () => {
    const payload = formValuesToUpdatePayload({
      first_name: 'Juan',
      middle_name: '',
      last_name: 'Dela Cruz',
      date_of_birth: '1990-05-15',
      gender: 'female',
      primary_contact_number: '+639123456789',
      emergency_contact_number: '',
      email: '',
      address: '',
      remarks: '',
    });

    expect(payload.first_name).toBe('Juan');
    expect(payload.last_name).toBe('Dela Cruz');
    expect(payload.gender).toBe('female');
    expect(payload.date_of_birth).toBe('1990-05-15');
  });

  it('handles undefined optional values like empty ones (exclude_none)', () => {
    const partial = formValuesToUpdatePayload({
      ...formValues,
      middle_name: undefined as unknown as string,
      email: undefined as unknown as string,
    });

    expect(partial).not.toHaveProperty('middle_name');
    expect(partial).not.toHaveProperty('email');
  });
});
