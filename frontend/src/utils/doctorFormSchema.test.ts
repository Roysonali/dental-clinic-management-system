import { describe, it, expect } from 'vitest';
import { doctorFormSchema } from './doctorFormSchema';
import type { DoctorFormValues } from '../types/doctor';

/** A valid minimal form (empty optionals). */
const validForm: DoctorFormValues = {
  user_id: '3',
  date_of_birth: '',
  gender: '',
  primary_phone: '+639171234567',
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
};

function parse(patch: Partial<DoctorFormValues>) {
  return doctorFormSchema.safeParse({ ...validForm, ...patch });
}

describe('doctorFormSchema', () => {
  describe('user_id', () => {
    it('accepts a positive integer', () => {
      expect(parse({ user_id: '3' }).success).toBe(true);
    });

    it('rejects empty, non-numeric and non-positive values', () => {
      expect(parse({ user_id: '' }).success).toBe(false);
      expect(parse({ user_id: 'abc' }).success).toBe(false);
      expect(parse({ user_id: '0' }).success).toBe(false);
    });
  });

  describe('primary_phone', () => {
    it('accepts a valid 10–15 digit phone (with optional +)', () => {
      expect(parse({ primary_phone: '+639171234567' }).success).toBe(true);
      // Backend PHONE_PATTERN `^\+?[1-9]\d{9,14}$` — first digit must be 1–9.
      expect(parse({ primary_phone: '9171234567' }).success).toBe(true);
    });

    it('accepts formatted phones by stripping spaces/dashes/parentheses like the backend', () => {
      expect(parse({ primary_phone: '+63 917 123 4567' }).success).toBe(true);
      expect(parse({ primary_phone: '+63-917-123-4567' }).success).toBe(true);
      expect(parse({ primary_phone: '(+63)9171234567' }).success).toBe(true);
    });

    it('rejects letters, wrong lengths, leading-zero numbers and empty values', () => {
      expect(parse({ primary_phone: '' }).success).toBe(false);
      expect(parse({ primary_phone: '123456789' }).success).toBe(false); // 9 digits
      expect(parse({ primary_phone: '1234567890123456' }).success).toBe(false); // 16 digits
      expect(parse({ primary_phone: '09171234567' }).success).toBe(false); // leading 0
      expect(parse({ primary_phone: 'abc1234567' }).success).toBe(false);
    });
  });

  describe('emergency_contact_phone', () => {
    it('is optional but validated when present', () => {
      expect(parse({ emergency_contact_phone: '' }).success).toBe(true);
      expect(parse({ emergency_contact_phone: '+639177654321' }).success).toBe(true);
      expect(parse({ emergency_contact_phone: 'nope' }).success).toBe(false);
    });
  });

  describe('registration_number', () => {
    it('is optional and accepts uppercase letters, digits and hyphens (normalized)', () => {
      expect(parse({ registration_number: '' }).success).toBe(true);
      expect(parse({ registration_number: 'den-2020-12345' }).success).toBe(true);
      expect(parse({ registration_number: 'DEN2020' }).success).toBe(true);
    });

    it('rejects disallowed characters and over-length values', () => {
      expect(parse({ registration_number: 'DEN 2020' }).success).toBe(false);
      expect(parse({ registration_number: 'DEN@2020' }).success).toBe(false);
      expect(parse({ registration_number: 'A'.repeat(101) }).success).toBe(false);
    });
  });

  describe('date_of_birth', () => {
    it('is optional and accepts ISO dates not in the future with year ≥ 1900', () => {
      expect(parse({ date_of_birth: '' }).success).toBe(true);
      expect(parse({ date_of_birth: '1985-06-15' }).success).toBe(true);
      expect(parse({ date_of_birth: '1900-01-01' }).success).toBe(true);
    });

    it('rejects future dates, pre-1900 years and malformed strings', () => {
      const future = new Date();
      future.setFullYear(future.getFullYear() + 1);
      const futureIso = future.toISOString().slice(0, 10);
      expect(parse({ date_of_birth: futureIso }).success).toBe(false);
      expect(parse({ date_of_birth: '1899-12-31' }).success).toBe(false);
      expect(parse({ date_of_birth: '15/06/1985' }).success).toBe(false);
    });
  });

  describe('gender', () => {
    it('is optional and restricted to the backend enum', () => {
      expect(parse({ gender: '' }).success).toBe(true);
      expect(parse({ gender: 'male' }).success).toBe(true);
      expect(parse({ gender: 'female' }).success).toBe(true);
      expect(parse({ gender: 'other' }).success).toBe(true);
      expect(parse({ gender: 'unknown' }).success).toBe(false);
    });
  });

  describe('years_of_experience', () => {
    it('is optional and bounded 0–50', () => {
      expect(parse({ years_of_experience: '' }).success).toBe(true);
      expect(parse({ years_of_experience: '0' }).success).toBe(true);
      expect(parse({ years_of_experience: '50' }).success).toBe(true);
      expect(parse({ years_of_experience: '-1' }).success).toBe(false);
      expect(parse({ years_of_experience: '51' }).success).toBe(false);
      expect(parse({ years_of_experience: 'abc' }).success).toBe(false);
    });
  });

  describe('consultation_fee', () => {
    it('is optional, positive, with at most 2 decimals and 10 digits', () => {
      expect(parse({ consultation_fee: '' }).success).toBe(true);
      expect(parse({ consultation_fee: '800' }).success).toBe(true);
      expect(parse({ consultation_fee: '800.5' }).success).toBe(true);
      expect(parse({ consultation_fee: '12345678.90' }).success).toBe(true);
      expect(parse({ consultation_fee: '0' }).success).toBe(false);
      expect(parse({ consultation_fee: '-5' }).success).toBe(false);
      expect(parse({ consultation_fee: '800.123' }).success).toBe(false);
      expect(parse({ consultation_fee: '12345678901' }).success).toBe(false); // 11 digits
    });
  });

  describe('consultation_duration', () => {
    it('is optional and bounded 15–240 minutes', () => {
      expect(parse({ consultation_duration: '' }).success).toBe(true);
      expect(parse({ consultation_duration: '15' }).success).toBe(true);
      expect(parse({ consultation_duration: '240' }).success).toBe(true);
      expect(parse({ consultation_duration: '14' }).success).toBe(false);
      expect(parse({ consultation_duration: '241' }).success).toBe(false);
      expect(parse({ consultation_duration: '30.5' }).success).toBe(false);
    });
  });

  describe('languages_known', () => {
    it('accepts an empty list and rejects empty/whitespace items', () => {
      expect(parse({ languages_known: [] }).success).toBe(true);
      expect(parse({ languages_known: ['English', 'Filipino'] }).success).toBe(true);
      expect(parse({ languages_known: ['English', ''] }).success).toBe(false);
      expect(parse({ languages_known: ['   '] }).success).toBe(false);
    });

    it('accepts language names with accented and special characters', () => {
      expect(parse({ languages_known: ['Español'] }).success).toBe(true);
      expect(parse({ languages_known: ['Français'] }).success).toBe(true);
      expect(parse({ languages_known: ['Deutsch'] }).success).toBe(true);
      expect(parse({ languages_known: ['Österreich'] }).success).toBe(true);
      expect(parse({ languages_known: ['Ñáhuitl'] }).success).toBe(true);
      expect(parse({ languages_known: ['Bahasa Indonesia', 'Pilipino/Tagalog'] }).success).toBe(true);
    });
  });

  describe('biography', () => {
    it('is optional, ≤ 2000 chars and not whitespace-only', () => {
      expect(parse({ biography: '' }).success).toBe(true);
      expect(parse({ biography: 'Experienced dentist.' }).success).toBe(true);
      expect(parse({ biography: '   ' }).success).toBe(false);
      expect(parse({ biography: 'A'.repeat(2001) }).success).toBe(false);
    });
  });

  describe('profile_photo_url', () => {
    it('is optional and must be a valid URL when present', () => {
      expect(parse({ profile_photo_url: '' }).success).toBe(true);
      expect(parse({ profile_photo_url: 'https://cdn.example.com/photo.jpg' }).success).toBe(true);
      expect(parse({ profile_photo_url: 'not-a-url' }).success).toBe(false);
    });
  });

  describe('free-text length limits', () => {
    it('enforces address ≤ 500, qualification ≤ 500, emergency name ≤ 100', () => {
      expect(parse({ address: 'A'.repeat(500) }).success).toBe(true);
      expect(parse({ address: 'A'.repeat(501) }).success).toBe(false);
      expect(parse({ qualification: 'B'.repeat(500) }).success).toBe(true);
      expect(parse({ qualification: 'B'.repeat(501) }).success).toBe(false);
      expect(parse({ emergency_contact_name: 'C'.repeat(100) }).success).toBe(true);
      expect(parse({ emergency_contact_name: 'C'.repeat(101) }).success).toBe(false);
    });
  });

  describe('whole form', () => {
    it('accepts a fully populated valid form', () => {
      expect(
        parse({
          date_of_birth: '1985-06-15',
          gender: 'male',
          address: '123 Rizal St.',
          qualification: 'DMD',
          registration_number: 'DEN-2020-12345',
          years_of_experience: '10',
          consultation_fee: '800.00',
          consultation_duration: '30',
          languages_known: ['English', 'Filipino'],
          biography: 'Experienced.',
          emergency_contact_name: 'Maria',
          emergency_contact_phone: '+639177654321',
        }).success,
      ).toBe(true);
    });
  });
});
