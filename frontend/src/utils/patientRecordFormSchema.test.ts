import { describe, it, expect } from 'vitest';
import {
  attachmentEditFormSchema,
  attachmentFormSchema,
  diagnosisFormSchema,
  followupFormSchema,
  patientRecordFormSchema,
  prescriptionFormSchema,
} from './patientRecordFormSchema';
import { todayLocalISO } from './date';

describe('patientRecordFormSchema', () => {
  const validBase = {
    patient_id: 'p1',
    appointment_id: 'a1',
    chief_complaint: '',
    clinical_notes: '',
    doctor_remarks: '',
    treatment_recommendation: '',
    systemic_diseases: '',
    surgeries: '',
    medications: '',
    habits: '',
    medical_alerts: '',
    allergies: '',
    dental_history: '',
  };

  it('accepts a minimal valid record', () => {
    expect(patientRecordFormSchema.safeParse(validBase).success).toBe(true);
  });

  it('requires patient and appointment', () => {
    const { error } = patientRecordFormSchema.safeParse({ ...validBase, patient_id: '' });
    expect(error?.issues.some((i) => i.path[0] === 'patient_id')).toBe(true);

    const { error: error2 } = patientRecordFormSchema.safeParse({ ...validBase, appointment_id: '' });
    expect(error2?.issues.some((i) => i.path[0] === 'appointment_id')).toBe(true);
  });

  it('enforces the 5000-char limit on non-clinical-notes fields', () => {
    const long = 'x'.repeat(5001);
    const { error } = patientRecordFormSchema.safeParse({ ...validBase, chief_complaint: long });
    expect(error?.issues.some((i) => i.path[0] === 'chief_complaint')).toBe(true);
  });

  it('enforces the 10000-char limit on clinical notes', () => {
    const ok = 'x'.repeat(10000);
    expect(patientRecordFormSchema.safeParse({ ...validBase, clinical_notes: ok }).success).toBe(true);

    const { error } = patientRecordFormSchema.safeParse({
      ...validBase,
      clinical_notes: 'x'.repeat(10001),
    });
    expect(error?.issues.some((i) => i.path[0] === 'clinical_notes')).toBe(true);
  });
});

describe('diagnosisFormSchema', () => {
  const valid = { diagnosis_name: 'Dental Caries', diagnosis_type: 'PROVISIONAL', notes: '' };

  it('accepts a valid diagnosis', () => {
    expect(diagnosisFormSchema.safeParse(valid).success).toBe(true);
  });

  it('requires a name of at least 2 characters', () => {
    const { error } = diagnosisFormSchema.safeParse({ ...valid, diagnosis_name: 'A' });
    expect(error?.issues.some((i) => i.path[0] === 'diagnosis_name')).toBe(true);
  });

  it('rejects unknown diagnosis types', () => {
    const { error } = diagnosisFormSchema.safeParse({ ...valid, diagnosis_type: 'OTHER' });
    expect(error?.issues.some((i) => i.path[0] === 'diagnosis_type')).toBe(true);
  });

  it('enforces the 2000-char notes limit', () => {
    const { error } = diagnosisFormSchema.safeParse({ ...valid, notes: 'x'.repeat(2001) });
    expect(error?.issues.some((i) => i.path[0] === 'notes')).toBe(true);
  });
});

describe('prescriptionFormSchema', () => {
  const validItem = {
    medicine_name: 'Amoxicillin',
    dosage: '500mg',
    frequency: 'TDS',
    duration: '5 days',
    instructions: '',
  };

  it('accepts 1–20 items', () => {
    expect(prescriptionFormSchema.safeParse({ notes: '', items: [validItem] }).success).toBe(true);
    const twenty = Array.from({ length: 20 }, () => ({ ...validItem }));
    expect(prescriptionFormSchema.safeParse({ notes: '', items: twenty }).success).toBe(true);
  });

  it('rejects an empty item list', () => {
    const { error } = prescriptionFormSchema.safeParse({ notes: '', items: [] });
    expect(error?.issues.some((i) => i.path[0] === 'items')).toBe(true);
  });

  it('rejects more than 20 items', () => {
    const twentyOne = Array.from({ length: 21 }, () => ({ ...validItem }));
    const { error } = prescriptionFormSchema.safeParse({ notes: '', items: twentyOne });
    expect(error?.issues.some((i) => i.path[0] === 'items')).toBe(true);
  });

  it('rejects an item missing medicine_name', () => {
    const { error } = prescriptionFormSchema.safeParse({
      notes: '',
      items: [{ ...validItem, medicine_name: '' }],
    });
    // Nested field → path is ['items', 0, 'medicine_name']
    expect(error?.issues.some((i) => i.path[0] === 'items')).toBe(true);
    expect(error?.issues.some((i) => i.path.at(-1) === 'medicine_name')).toBe(true);
  });
});

describe('attachmentFormSchema', () => {
  const makeFile = (name = 'opg.pdf', type = 'application/pdf', size = 1024) =>
    new File(['x'.repeat(size)], name, { type });

  it('accepts a valid file + type', () => {
    const valid = { attachment_type: 'PDF', file: makeFile() };
    expect(attachmentFormSchema.safeParse(valid).success).toBe(true);
  });

  it('requires an attachment type', () => {
    const { error } = attachmentFormSchema.safeParse({
      attachment_type: '',
      file: makeFile(),
    });
    expect(error?.issues.some((i) => i.path[0] === 'attachment_type')).toBe(true);
  });

  it('requires a file', () => {
    const { error } = attachmentFormSchema.safeParse({ attachment_type: 'PDF', file: null });
    expect(error?.issues.some((i) => i.path[0] === 'file')).toBe(true);
  });

  it('rejects a file over the 10 MB limit', () => {
    const big = makeFile('big.pdf', 'application/pdf', 10 * 1024 * 1024 + 1);
    const { error } = attachmentFormSchema.safeParse({ attachment_type: 'PDF', file: big });
    expect(error?.issues.some((i) => i.path[0] === 'file')).toBe(true);
  });

  it('rejects an unsupported file type', () => {
    const exe = new File(['MZ'], 'script.exe', { type: 'application/x-msdownload' });
    const { error } = attachmentFormSchema.safeParse({ attachment_type: 'PDF', file: exe });
    expect(error?.issues.some((i) => i.path[0] === 'file')).toBe(true);
  });

  it('accepts an image file for the IMAGE type', () => {
    const png = new File(['\x89PNG'], 'xray.png', { type: 'image/png' });
    expect(attachmentFormSchema.safeParse({ attachment_type: 'IMAGE', file: png }).success).toBe(true);
  });

  it('edit schema validates only the type (file always null)', () => {
    expect(attachmentEditFormSchema.safeParse({ attachment_type: 'PDF', file: null }).success).toBe(true);
    expect(attachmentEditFormSchema.safeParse({ attachment_type: '', file: null }).success).toBe(false);
  });
});

describe('followupFormSchema', () => {
  const valid = { followup_date: todayLocalISO(), notes: '' };

  it('accepts today as the earliest valid date', () => {
    expect(followupFormSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts a future date', () => {
    const future = '2999-01-01';
    expect(followupFormSchema.safeParse({ ...valid, followup_date: future }).success).toBe(true);
  });

  it('rejects a past date', () => {
    const { error } = followupFormSchema.safeParse({ ...valid, followup_date: '2000-01-01' });
    expect(error?.issues.some((i) => i.path[0] === 'followup_date')).toBe(true);
  });

  it('rejects malformed dates', () => {
    const { error } = followupFormSchema.safeParse({ ...valid, followup_date: '01/01/2026' });
    expect(error?.issues.some((i) => i.path[0] === 'followup_date')).toBe(true);
  });
});
