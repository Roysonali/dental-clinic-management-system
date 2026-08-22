import { describe, it, expect } from 'vitest';
import {
  createPayloadFromForm,
  normalizeLanguages,
  normalizePhone,
  normalizeRegistrationNumber,
  responseToFormValues,
  updatePayloadFromForm,
} from './doctorFormUtils';
import type { DoctorFormValues, DoctorResponse } from '../types/doctor';

const doctor: DoctorResponse = {
  id: 'd1',
  doctor_code: 'DOC-00001',
  user_id: 3,
  user_full_name: 'Dr. Jose Rizal',
  user_email: 'jose@clinic.com',
  date_of_birth: '1985-06-15',
  gender: 'male',
  primary_phone: '+639171234567',
  address: '123 Rizal St., Manila',
  qualification: 'DMD',
  registration_number: 'DEN-2020-12345',
  years_of_experience: 10,
  consultation_fee: 800,
  consultation_duration: 30,
  languages_known: ['English', 'Filipino'],
  profile_photo_url: null,
  biography: 'Experienced dentist.',
  emergency_contact_name: 'Maria Dela Cruz',
  emergency_contact_phone: '+639177654321',
  available_for_appointment: true,
  on_leave: false,
  is_active: true,
  specializations: [],
  created_by: null,
  updated_by: null,
  created_at: '2026-07-07T10:00:00Z',
  updated_at: '2026-07-07T10:00:00Z',
};

const form: DoctorFormValues = {
  user_id: '3',
  date_of_birth: '1985-06-15',
  gender: 'male',
  primary_phone: '+63 917 123 4567',
  address: '123 Rizal St., Manila',
  qualification: 'DMD',
  registration_number: 'den-2020-12345',
  years_of_experience: '10',
  consultation_fee: '800.00',
  consultation_duration: '30',
  languages_known: ['english', 'English', 'filipino'],
  profile_photo_url: '',
  biography: 'Experienced dentist.',
  emergency_contact_name: 'Maria Dela Cruz',
  emergency_contact_phone: '+63-917-765-4321',
};

describe('doctorFormUtils', () => {
  describe('normalizePhone', () => {
    it('strips whitespace, hyphens and parentheses (keeps +)', () => {
      expect(normalizePhone('+63 917 123 4567')).toBe('+639171234567');
      expect(normalizePhone('(+63)917-123-4567')).toBe('+639171234567');
      expect(normalizePhone(null)).toBeNull();
    });
  });

  describe('normalizeRegistrationNumber', () => {
    it('trims and uppercases', () => {
      expect(normalizeRegistrationNumber('  den-2020-12345 ')).toBe('DEN-2020-12345');
      expect(normalizeRegistrationNumber(null)).toBeNull();
      expect(normalizeRegistrationNumber('   ')).toBeNull();
    });
  });

  describe('normalizeLanguages', () => {
    it('title-cases, trims and deduplicates (first occurrence wins)', () => {
      expect(normalizeLanguages(['english', 'English', ' filipino '])).toEqual([
        'English',
        'Filipino',
      ]);
    });

    it('drops empty entries', () => {
      expect(normalizeLanguages(['', '   ', 'English'])).toEqual(['English']);
    });

    it('preserves accented characters (Español, Français, Deutsch)', () => {
      expect(normalizeLanguages(['español'])).toEqual(['Español']);
      expect(normalizeLanguages(['français'])).toEqual(['Français']);
      expect(normalizeLanguages(['deutsch'])).toEqual(['Deutsch']);
    });

    it('title-cases languages starting with non-ASCII letters (Österreich, Ñáhuitl)', () => {
      expect(normalizeLanguages(['österreich'])).toEqual(['Österreich']);
      expect(normalizeLanguages(['ñáhuitl'])).toEqual(['Ñáhuitl']);
    });

    it('handles mixed scripts and special punctuation in language names', () => {
      expect(normalizeLanguages(['Bahasa Indonesia', 'Pilipino/Tagalog'])).toEqual([
        'Bahasa Indonesia',
        'Pilipino/Tagalog',
      ]);
    });
  });

  describe('responseToFormValues', () => {
    it('maps every response field into editable form values', () => {
      const values = responseToFormValues(doctor);

      expect(values).toEqual({
        user_id: '3',
        date_of_birth: '1985-06-15',
        gender: 'male',
        primary_phone: '+639171234567',
        address: '123 Rizal St., Manila',
        qualification: 'DMD',
        registration_number: 'DEN-2020-12345',
        years_of_experience: '10',
        consultation_fee: '800',
        consultation_duration: '30',
        languages_known: ['English', 'Filipino'],
        profile_photo_url: '',
        biography: 'Experienced dentist.',
        emergency_contact_name: 'Maria Dela Cruz',
        emergency_contact_phone: '+639177654321',
      });
    });

    it('converts null optionals to empty strings / arrays', () => {
      const values = responseToFormValues({ ...doctor, date_of_birth: null, gender: null, languages_known: null });
      expect(values.date_of_birth).toBe('');
      expect(values.gender).toBe('');
      expect(values.languages_known).toEqual([]);
    });
  });

  describe('createPayloadFromForm', () => {
    it('normalizes phone, registration and languages; parses numbers; parses user_id', () => {
      const payload = createPayloadFromForm(form);

      expect(payload).toEqual({
        user_id: 3,
        primary_phone: '+639171234567',
        date_of_birth: '1985-06-15',
        gender: 'male',
        address: '123 Rizal St., Manila',
        qualification: 'DMD',
        registration_number: 'DEN-2020-12345',
        years_of_experience: 10,
        consultation_fee: 800,
        consultation_duration: 30,
        languages_known: ['English', 'Filipino'],
        profile_photo_url: null,
        biography: 'Experienced dentist.',
        emergency_contact_name: 'Maria Dela Cruz',
        emergency_contact_phone: '+639177654321',
      });
    });

    it('maps empty optionals to null and empty languages to null', () => {
      const empty: DoctorFormValues = {
        ...form,
        date_of_birth: '',
        gender: '',
        address: '   ',
        qualification: '',
        registration_number: '',
        years_of_experience: '',
        consultation_fee: '',
        consultation_duration: '',
        languages_known: [],
        profile_photo_url: '',
        biography: '',
        emergency_contact_name: '',
        emergency_contact_phone: '',
      };

      expect(createPayloadFromForm(empty)).toEqual({
        user_id: 3,
        primary_phone: '+639171234567',
        date_of_birth: null,
        gender: null,
        address: null,
        qualification: null,
        registration_number: null,
        years_of_experience: null,
        consultation_fee: null,
        consultation_duration: null,
        languages_known: null,
        profile_photo_url: null,
        biography: null,
        emergency_contact_name: null,
        emergency_contact_phone: null,
      });
    });
  });

  describe('updatePayloadFromForm', () => {
    it('always sends primary_phone and normalizes it', () => {
      const payload = updatePayloadFromForm(form);
      expect(payload.primary_phone).toBe('+639171234567');
    });

    it('omits empty optional fields (PATCH exclude_unset semantics)', () => {
      const payload = updatePayloadFromForm({
        ...form,
        date_of_birth: '',
        gender: '',
        address: '',
        qualification: '',
        registration_number: '',
        years_of_experience: '',
        consultation_fee: '',
        consultation_duration: '',
        languages_known: [],
        profile_photo_url: '',
        biography: '',
        emergency_contact_name: '',
        emergency_contact_phone: '',
      });

      expect(payload).toEqual({ primary_phone: '+639171234567' });
    });

    it('never includes read-only fields (user_id / doctor_code)', () => {
      const payload = updatePayloadFromForm(form);
      expect(payload).not.toHaveProperty('user_id');
      expect(payload).not.toHaveProperty('doctor_code');
    });

    it('includes populated optionals with normalization', () => {
      const payload = updatePayloadFromForm(form);

      expect(payload).toMatchObject({
        date_of_birth: '1985-06-15',
        gender: 'male',
        address: '123 Rizal St., Manila',
        qualification: 'DMD',
        registration_number: 'DEN-2020-12345',
        years_of_experience: 10,
        consultation_fee: 800,
        consultation_duration: 30,
        languages_known: ['English', 'Filipino'],
        biography: 'Experienced dentist.',
        emergency_contact_name: 'Maria Dela Cruz',
        emergency_contact_phone: '+639177654321',
      });
    });
  });

  // -------------------------------------------------------------------
  // F3 — explicit-null PATCH semantics (baseline-aware)
  // -------------------------------------------------------------------

  describe('updatePayloadFromForm with original baseline (F3 nullability)', () => {
    /** The record as fetched by the edit drawer before any edits. */
    const baseline = doctor;

    it('clearing biography sends explicit null', () => {
      const values = responseToFormValues(baseline);
      values.biography = '';
      const payload = updatePayloadFromForm(values, baseline);
      expect(payload.biography).toBeNull();
    });

    it('clearing address sends explicit null', () => {
      const values = responseToFormValues(baseline);
      values.address = '   ';
      const payload = updatePayloadFromForm(values, baseline);
      expect(payload.address).toBeNull();
    });

    it('clearing registration number sends explicit null', () => {
      const values = responseToFormValues(baseline);
      values.registration_number = '';
      const payload = updatePayloadFromForm(values, baseline);
      expect(payload.registration_number).toBeNull();
    });

    it('clearing emergency contact sends explicit null for name and phone', () => {
      const values = responseToFormValues(baseline);
      values.emergency_contact_name = '';
      values.emergency_contact_phone = '';
      const payload = updatePayloadFromForm(values, baseline);
      expect(payload.emergency_contact_name).toBeNull();
      expect(payload.emergency_contact_phone).toBeNull();
    });

    it('clearing languages / DOB / gender / photo / fee / numbers sends null', () => {
      // Baseline has a populated photo URL so clearing it must send null
      // (the default fixture has profile_photo_url null → clearing is a no-op).
      const withPhoto = { ...baseline, profile_photo_url: 'https://example.com/photo.jpg' };
      const values = responseToFormValues(withPhoto);
      values.languages_known = [];
      values.date_of_birth = '';
      values.gender = '';
      values.profile_photo_url = '';
      values.consultation_fee = '';
      values.years_of_experience = '';
      values.consultation_duration = '';
      const payload = updatePayloadFromForm(values, withPhoto);
      expect(payload.languages_known).toBeNull();
      expect(payload.date_of_birth).toBeNull();
      expect(payload.gender).toBeNull();
      expect(payload.profile_photo_url).toBeNull();
      expect(payload.consultation_fee).toBeNull();
      expect(payload.years_of_experience).toBeNull();
      expect(payload.consultation_duration).toBeNull();
    });

    it('unchanged optional fields remain omitted', () => {
      // Form values exactly equal to the baseline → nothing to send.
      const values = responseToFormValues(baseline);
      const payload = updatePayloadFromForm(values, baseline);
      expect(payload).toEqual({ primary_phone: '+639171234567' });
    });

    it('normalized-equivalent unchanged fields remain omitted', () => {
      // Phone formatting differs but normalizes to the stored value.
      const values = responseToFormValues({
        ...baseline,
        primary_phone: '+63 917 123 4567',
      });
      const payload = updatePayloadFromForm(values, baseline);
      expect(payload).toEqual({ primary_phone: '+639171234567' });
    });

    it('required fields are unaffected', () => {
      const values = responseToFormValues(baseline);
      const payload = updatePayloadFromForm(values, baseline);
      expect(payload.primary_phone).toBe('+639171234567');
      expect(payload).not.toHaveProperty('user_id');
      expect(payload).not.toHaveProperty('doctor_code');
    });

    it('changed optional fields are sent with normalized values', () => {
      const values = responseToFormValues(baseline);
      values.qualification = 'DDS, MS Ortho';
      values.biography = 'Updated biography.';
      values.languages_known = ['English', 'Tagalog'];
      const payload = updatePayloadFromForm(values, baseline);
      expect(payload.qualification).toBe('DDS, MS Ortho');
      expect(payload.biography).toBe('Updated biography.');
      expect(payload.languages_known).toEqual(['English', 'Tagalog']);
    });

    it('no unnecessary nulls are sent when baseline is already empty', () => {
      const sparse: DoctorResponse = { ...doctor, biography: null, address: null };
      const values = responseToFormValues(sparse);
      values.biography = '';
      values.address = '';
      const payload = updatePayloadFromForm(values, sparse);
      expect(payload).toEqual({ primary_phone: '+639171234567' });
    });
  });

});
