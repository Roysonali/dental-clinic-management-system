import { describe, it, expect } from 'vitest';
import {
  attachmentFormValuesToUpdateRequest,
  attachmentFormValuesToUploadRequest,
  diagnosisFormValuesToCreateRequest,
  diagnosisFormValuesToUpdateRequest,
  followupFormValuesToCreateRequest,
  followupFormValuesToUpdateRequest,
  prescriptionFormValuesToCreateRequest,
  prescriptionItemFormValuesToRequest,
  recordFormValuesToCreateRequest,
  recordFormValuesToUpdateRequest,
} from './patientRecordFormUtils';
import type { PatientRecordResponse } from '../types/patientRecord';

const baseValues = {
  patient_id: 'p1',
  appointment_id: 'a1',
  chief_complaint: 'Pain',
  clinical_notes: 'Notes',
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

describe('recordFormValuesToCreateRequest', () => {
  it('maps ids + trims and nulls empty text fields', () => {
    const request = recordFormValuesToCreateRequest(baseValues);

    expect(request.patient_id).toBe('p1');
    expect(request.appointment_id).toBe('a1');
    expect(request.chief_complaint).toBe('Pain');
    expect(request.clinical_notes).toBe('Notes');
    expect(request.doctor_remarks).toBeNull();
    expect(request.allergies).toBeNull();
  });

  it('never includes status/is_finalized or server-managed fields', () => {
    const request = recordFormValuesToCreateRequest(baseValues);
    expect('status' in request).toBe(false);
    expect('is_finalized' in request).toBe(false);
    expect('created_at' in request).toBe(false);
  });
});

describe('recordFormValuesToUpdateRequest (exclude_unset semantics)', () => {
  const original: PatientRecordResponse = {
    id: 'r1',
    patient_id: 'p1',
    appointment_id: 'a1',
    status: 'DRAFT',
    is_finalized: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    chief_complaint: 'Pain',
    clinical_notes: 'Notes',
    doctor_remarks: 'Remark',
    treatment_recommendation: null,
    systemic_diseases: null,
    surgeries: null,
    medications: null,
    habits: null,
    medical_alerts: null,
    allergies: 'Pollen',
    dental_history: null,
    diagnoses: [],
    prescriptions: [],
    followups: [],
    attachments: [],
    audit_logs: [],
    diagnosis_count: 0,
    prescription_count: 0,
    attachment_count: 0,
    followup_count: 0,
  };

  it('omits untouched fields', () => {
    const values = { ...baseValues, doctor_remarks: 'Remark', allergies: 'Pollen' };
    const request = recordFormValuesToUpdateRequest(values, original);

    expect(request.chief_complaint).toBeUndefined();
    expect(request.doctor_remarks).toBeUndefined();
    expect(request.allergies).toBeUndefined();
    expect(request.clinical_notes).toBeUndefined();
  });

  it('sends explicit null when a field is cleared', () => {
    const values = { ...baseValues, allergies: '', doctor_remarks: '' };
    const request = recordFormValuesToUpdateRequest(values, original);

    expect(request.allergies).toBeNull();
    expect(request.doctor_remarks).toBeNull();
  });

  it('sends a changed value verbatim', () => {
    const values = { ...baseValues, chief_complaint: 'Sharp pain' };
    const request = recordFormValuesToUpdateRequest(values, original);

    expect(request.chief_complaint).toBe('Sharp pain');
  });

  it('never includes immutable ids or status', () => {
    const request = recordFormValuesToUpdateRequest(baseValues, original);
    expect('patient_id' in request).toBe(false);
    expect('appointment_id' in request).toBe(false);
    expect('status' in request).toBe(false);
  });
});

describe('diagnosis transformers', () => {
  it('maps create values to a request', () => {
    const request = diagnosisFormValuesToCreateRequest({
      diagnosis_name: '  Caries  ',
      diagnosis_type: 'CONFIRMED',
      notes: '',
    });
    expect(request).toEqual({
      diagnosis_name: 'Caries',
      diagnosis_type: 'CONFIRMED',
      notes: null,
    });
  });

  it('update includes only changed fields', () => {
    const request = diagnosisFormValuesToUpdateRequest(
      { diagnosis_name: 'Caries', diagnosis_type: 'CONFIRMED', notes: 'Severe' },
      { diagnosis_name: 'Caries', diagnosis_type: 'PROVISIONAL', notes: null },
    );
    expect(request).toEqual({ diagnosis_type: 'CONFIRMED', notes: 'Severe' });
    expect('diagnosis_name' in request).toBe(false);
  });
});

describe('prescription transformers', () => {
  it('builds a prescription request with trimmed items', () => {
    const request = prescriptionFormValuesToCreateRequest({
      notes: '  After meals  ',
      items: [
        {
          medicine_name: '  Amoxicillin ',
          dosage: '500mg',
          frequency: 'TDS',
          duration: '5 days',
          instructions: '',
        },
      ],
    });
    expect(request.notes).toBe('After meals');
    expect(request.items[0].medicine_name).toBe('Amoxicillin');
    expect(request.items[0].instructions).toBeNull();
  });

  it('prescriptionItemFormValuesToRequest trims required text', () => {
    const item = prescriptionItemFormValuesToRequest({
      medicine_name: ' Ibuprofen ',
      dosage: ' 200mg ',
      frequency: ' BD ',
      duration: ' 3 days ',
      instructions: '',
    });
    expect(item).toEqual({
      medicine_name: 'Ibuprofen',
      dosage: '200mg',
      frequency: 'BD',
      duration: '3 days',
      instructions: null,
    });
  });
});

describe('attachment transformers', () => {
  it('builds a multipart upload payload from the selected file + type', () => {
    const file = new File(['%PDF-1.4'], 'opg.pdf', { type: 'application/pdf' });
    const request = attachmentFormValuesToUploadRequest({
      attachment_type: 'PDF',
      file,
    });
    expect(request).toEqual({ file, attachment_type: 'PDF' });
  });

  it('throws when no file is selected', () => {
    expect(() =>
      attachmentFormValuesToUploadRequest({ attachment_type: 'PDF', file: null }),
    ).toThrow('No file selected');
  });

  it('update only ever carries a changed type (file immutable)', () => {
    const request = attachmentFormValuesToUpdateRequest(
      { attachment_type: 'DOCUMENT', file: null },
      { attachment_type: 'PDF' },
    );
    expect(request).toEqual({ attachment_type: 'DOCUMENT' });
  });

  it('update omits the type when unchanged', () => {
    const request = attachmentFormValuesToUpdateRequest(
      { attachment_type: 'PDF', file: null },
      { attachment_type: 'PDF' },
    );
    expect(request).toEqual({});
  });
});

describe('followup transformers', () => {
  it('create maps date + nullable notes', () => {
    expect(followupFormValuesToCreateRequest({ followup_date: '2026-09-01', notes: 'Review' })).toEqual({
      followup_date: '2026-09-01',
      notes: 'Review',
    });
  });

  it('update includes only changed fields', () => {
    const request = followupFormValuesToUpdateRequest(
      { followup_date: '2026-09-01', notes: '' },
      { followup_date: '2026-08-01', notes: 'Review' },
    );
    expect(request.followup_date).toBe('2026-09-01');
    expect(request.notes).toBeNull();
  });
});
