import { describe, it, expect, vi, beforeEach } from 'vitest';
import { patientRecordService } from './patientRecordService';
import { api } from './api';

vi.mock('./api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const getMock = vi.mocked(api.get);
const postMock = vi.mocked(api.post);
const patchMock = vi.mocked(api.patch);
const deleteMock = vi.mocked(api.delete);

const recordListItem = {
  id: 'r1',
  patient_id: 'p1',
  appointment_id: 'a1',
  status: 'DRAFT',
  is_finalized: false,
  chief_complaint: 'Pain',
  created_at: '2026-08-01T08:00:00Z',
};

const listEnvelope = {
  items: [recordListItem],
  total: 1,
  page: 1,
  page_size: 20,
  pages: 1,
};

const detailResponse = {
  ...recordListItem,
  clinical_notes: null,
  doctor_remarks: null,
  treatment_recommendation: null,
  systemic_diseases: null,
  surgeries: null,
  medications: null,
  habits: null,
  medical_alerts: null,
  allergies: null,
  dental_history: null,
  updated_at: '2026-08-01T08:00:00Z',
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

describe('patientRecordService — records', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    patchMock.mockReset();
    deleteMock.mockReset();
  });

  it('lists records with params (incl. status/is_finalized/search)', async () => {
    getMock.mockResolvedValue({ data: listEnvelope });
    const params = { page: 2, page_size: 50, status: 'UNDER_REVIEW' as const, is_finalized: false, search: 'pain' };

    await expect(patientRecordService.listRecords(params)).resolves.toEqual(listEnvelope);
    expect(getMock).toHaveBeenCalledWith('/patient-records', { params });
  });

  it('creates a record (POST /patient-records)', async () => {
    postMock.mockResolvedValue({ data: detailResponse });
    const payload = { patient_id: 'p1', appointment_id: 'a1', chief_complaint: 'Pain' };

    await expect(patientRecordService.createRecord(payload)).resolves.toEqual(detailResponse);
    expect(postMock).toHaveBeenCalledWith('/patient-records', payload);
  });

  it('fetches a single record by id', async () => {
    getMock.mockResolvedValue({ data: detailResponse });
    await patientRecordService.getRecord('r1');
    expect(getMock).toHaveBeenCalledWith('/patient-records/r1');
  });

  it('fetches the record for an appointment (404 → caller handles)', async () => {
    getMock.mockResolvedValue({ data: detailResponse });
    await patientRecordService.getRecordByAppointment('a1');
    expect(getMock).toHaveBeenCalledWith('/patient-records/appointment/a1');
  });

  it('lists records by patient', async () => {
    getMock.mockResolvedValue({ data: listEnvelope });
    await patientRecordService.listRecordsByPatient('p1', { page: 1, page_size: 10 });
    expect(getMock).toHaveBeenCalledWith('/patient-records/patient/p1', { params: { page: 1, page_size: 10 } });
  });

  it('PATCHes record updates', async () => {
    patchMock.mockResolvedValue({ data: detailResponse });
    await patientRecordService.updateRecord('r1', { chief_complaint: 'Updated' });
    expect(patchMock).toHaveBeenCalledWith('/patient-records/r1', { chief_complaint: 'Updated' });
  });

  it('changes status via the QUERY parameter (not a body)', async () => {
    patchMock.mockResolvedValue({ data: detailResponse });
    await patientRecordService.changeStatus('r1', 'COMPLETED');
    expect(patchMock).toHaveBeenCalledWith('/patient-records/r1/status', null, {
      params: { new_status: 'COMPLETED' },
    });
  });

  it('finalizes with the literal {confirm: true} body', async () => {
    postMock.mockResolvedValue({ data: detailResponse });
    await patientRecordService.finalizeRecord('r1');
    expect(postMock).toHaveBeenCalledWith('/patient-records/r1/finalize', { confirm: true });
  });

  it('DELETEs (204) with no body expectation', async () => {
    deleteMock.mockResolvedValue({ data: undefined });
    await expect(patientRecordService.deleteRecord('r1')).resolves.toBeUndefined();
    expect(deleteMock).toHaveBeenCalledWith('/patient-records/r1');
  });
});

describe('patientRecordService — children', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    patchMock.mockReset();
    deleteMock.mockReset();
  });

  it('wires diagnosis CRUD to the correct routes', async () => {
    getMock.mockResolvedValue({ data: listEnvelope });
    await patientRecordService.listDiagnoses('r1', { page: 1, page_size: 10, diagnosis_type: 'CONFIRMED' });
    expect(getMock).toHaveBeenCalledWith('/patient-records/r1/diagnoses', {
      params: { page: 1, page_size: 10, diagnosis_type: 'CONFIRMED' },
    });

    // GET /diagnoses/{id} — full diagnosis incl. notes (L-4 edit pre-fill).
    getMock.mockResolvedValue({ data: { id: 'd1', notes: 'stored' } });
    await patientRecordService.getDiagnosis('d1');
    expect(getMock).toHaveBeenCalledWith('/diagnoses/d1');

    postMock.mockResolvedValue({ data: {} });
    await patientRecordService.createDiagnosis('r1', { diagnosis_name: 'Caries', diagnosis_type: 'CONFIRMED' });
    expect(postMock).toHaveBeenCalledWith('/patient-records/r1/diagnoses', {
      diagnosis_name: 'Caries',
      diagnosis_type: 'CONFIRMED',
    });

    patchMock.mockResolvedValue({ data: {} });
    await patientRecordService.updateDiagnosis('d1', { notes: 'x' });
    expect(patchMock).toHaveBeenCalledWith('/diagnoses/d1', { notes: 'x' });

    deleteMock.mockResolvedValue({ data: undefined });
    await patientRecordService.deleteDiagnosis('d1');
    expect(deleteMock).toHaveBeenCalledWith('/diagnoses/d1');
  });

  it('wires prescription CRUD + notes-only update + item endpoints', async () => {
    getMock.mockResolvedValue({ data: listEnvelope });
    await patientRecordService.listPrescriptions('r1', { page: 1, page_size: 10 });
    expect(getMock).toHaveBeenCalledWith('/patient-records/r1/prescriptions', {
      params: { page: 1, page_size: 10 },
    });

    postMock.mockResolvedValue({ data: {} });
    await patientRecordService.createPrescription('r1', {
      notes: null,
      items: [{ medicine_name: 'Amox', dosage: '500mg', frequency: 'TDS', duration: '5d' }],
    });
    expect(postMock).toHaveBeenCalledWith('/patient-records/r1/prescriptions', {
      notes: null,
      items: [{ medicine_name: 'Amox', dosage: '500mg', frequency: 'TDS', duration: '5d' }],
    });

    patchMock.mockResolvedValue({ data: {} });
    await patientRecordService.updatePrescription('px1', { notes: 'Only notes' });
    expect(patchMock).toHaveBeenCalledWith('/prescriptions/px1', { notes: 'Only notes' });

    postMock.mockResolvedValue({ data: {} });
    await patientRecordService.createPrescriptionItem('px1', {
      medicine_name: 'Ibu', dosage: '200mg', frequency: 'BD', duration: '3d',
    });
    expect(postMock).toHaveBeenCalledWith('/prescriptions/px1/items', {
      medicine_name: 'Ibu', dosage: '200mg', frequency: 'BD', duration: '3d',
    });

    postMock.mockResolvedValue({ data: [] });
    await patientRecordService.bulkCreatePrescriptionItems('px1', []);
    expect(postMock).toHaveBeenCalledWith('/prescriptions/px1/items/bulk', []);
  });

  it('uploads an attachment as multipart form-data', async () => {
    postMock.mockResolvedValue({ data: {} });
    const file = new File(['%PDF-1.4 fake'], 'report.pdf', { type: 'application/pdf' });
    await patientRecordService.createAttachment('r1', { file, attachment_type: 'PDF' });

    const [url, body] = postMock.mock.calls[0];
    expect(url).toBe('/patient-records/r1/attachments');
    expect(body).toBeInstanceOf(FormData);
    const form = body as FormData;
    expect(form.get('file')).toBe(file);
    expect(form.get('attachment_type')).toBe('PDF');
  });

  it('lists attachments (created_at DESC)', async () => {
    getMock.mockResolvedValue({ data: listEnvelope });
    await patientRecordService.listAttachments('r1', { page: 1, page_size: 10 });
    expect(getMock).toHaveBeenCalledWith('/patient-records/r1/attachments', {
      params: { page: 1, page_size: 10 },
    });
  });

  it('downloads an attachment as a blob through the authorized endpoint', async () => {
    getMock.mockResolvedValue({ data: new Blob(['%PDF-1.4']) });
    await patientRecordService.downloadAttachment('at1');
    expect(getMock).toHaveBeenCalledWith('/attachments/at1/download', { responseType: 'blob' });
  });

  it('previews an attachment inline', async () => {
    getMock.mockResolvedValue({ data: new Blob(['x']) });
    await patientRecordService.previewAttachment('at1');
    expect(getMock).toHaveBeenCalledWith('/attachments/at1/preview', { responseType: 'blob' });
  });

  it('PATCHes attachment metadata (stored file immutable)', async () => {
    patchMock.mockResolvedValue({ data: {} });
    await patientRecordService.updateAttachment('at1', { attachment_type: 'SCAN' });
    expect(patchMock).toHaveBeenCalledWith('/attachments/at1', { attachment_type: 'SCAN' });
  });

  it('wires follow-up CRUD', async () => {
    postMock.mockResolvedValue({ data: {} });
    await patientRecordService.createFollowup('r1', { followup_date: '2026-09-01' });
    expect(postMock).toHaveBeenCalledWith('/patient-records/r1/followups', { followup_date: '2026-09-01' });

    getMock.mockResolvedValue({ data: listEnvelope });
    await patientRecordService.listFollowups('r1', { page: 1, page_size: 10 });
    expect(getMock).toHaveBeenCalledWith('/patient-records/r1/followups', {
      params: { page: 1, page_size: 10 },
    });

    patchMock.mockResolvedValue({ data: {} });
    await patientRecordService.updateFollowup('f1', { notes: 'x' });
    expect(patchMock).toHaveBeenCalledWith('/followups/f1', { notes: 'x' });
  });

  it('propagates axios errors to the caller', async () => {
    getMock.mockRejectedValue(new Error('Network Error'));
    await expect(patientRecordService.getRecord('r1')).rejects.toThrow('Network Error');
  });
});
