import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiosError, type InternalAxiosRequestConfig, type AxiosResponse } from 'axios';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { renderWithProviders } from '../../../test/testUtils';
import { PatientRecordListContainer } from './PatientRecordListContainer';
import { patientRecordService } from '../../../services/patientRecordService';
import { patientService } from '../../../services/patientService';
import { appointmentService } from '../../../services/appointmentService';
import { userService } from '../../../services/userService';
import type {
  PatientRecordListEnvelope,
  PatientRecordListItem,
  PatientRecordResponse,
} from '../../../types/patientRecord';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('../../../services/patientRecordService', () => ({
  patientRecordService: {
    createRecord: vi.fn(),
    listRecords: vi.fn(),
    getRecord: vi.fn(),
    getRecordByAppointment: vi.fn(),
    listRecordsByPatient: vi.fn(),
    updateRecord: vi.fn(),
    changeStatus: vi.fn(),
    finalizeRecord: vi.fn(),
    deleteRecord: vi.fn(),
    createDiagnosis: vi.fn(),
    getDiagnosis: vi.fn(),
    listDiagnoses: vi.fn(),
    updateDiagnosis: vi.fn(),
    deleteDiagnosis: vi.fn(),
    createPrescription: vi.fn(),
    listPrescriptions: vi.fn(),
    getPrescription: vi.fn(),
    updatePrescription: vi.fn(),
    deletePrescription: vi.fn(),
    createPrescriptionItem: vi.fn(),
    bulkCreatePrescriptionItems: vi.fn(),
    listPrescriptionItems: vi.fn(),
    updatePrescriptionItem: vi.fn(),
    deletePrescriptionItem: vi.fn(),
    createAttachment: vi.fn(),
    listAttachments: vi.fn(),
    getAttachment: vi.fn(),
    updateAttachment: vi.fn(),
    deleteAttachment: vi.fn(),
    createFollowup: vi.fn(),
    listFollowups: vi.fn(),
    updateFollowup: vi.fn(),
    deleteFollowup: vi.fn(),
  },
}));

vi.mock('../../../services/patientService', () => ({
  patientService: { list: vi.fn(), get: vi.fn() },
}));

vi.mock('../../../services/appointmentService', () => ({
  appointmentService: { list: vi.fn(), get: vi.fn() },
}));

vi.mock('../../../services/userService', () => ({
  userService: { get: vi.fn() },
}));

const listRecordsMock = vi.mocked(patientRecordService.listRecords);
const createRecordMock = vi.mocked(patientRecordService.createRecord);
const getByAppointmentMock = vi.mocked(patientRecordService.getRecordByAppointment);
const patientListMock = vi.mocked(patientService.list);
const patientGetMock = vi.mocked(patientService.get);
const appointmentListMock = vi.mocked(appointmentService.list);
const appointmentGetMock = vi.mocked(appointmentService.get);
const userGetMock = vi.mocked(userService.get);

const config: InternalAxiosRequestConfig = {} as InternalAxiosRequestConfig;

/** Build an AxiosError with an HTTP response (mirrors apiError.test.ts). */
function httpError(status: number, data?: unknown): AxiosError {
  const response = {
    status,
    statusText: '',
    headers: {},
    config,
    data,
  } as AxiosResponse;
  return new AxiosError(
    `Request failed with status code ${status}`,
    'ERR_BAD_REQUEST',
    config,
    undefined,
    response,
  );
}

const recordRow: PatientRecordListItem = {
  id: 'r1',
  patient_id: 'p1',
  appointment_id: 'a1',
  status: 'DRAFT',
  is_finalized: false,
  chief_complaint: 'Toothache',
  created_at: '2026-08-01T08:00:00Z',
};

const listEnvelope: PatientRecordListEnvelope<PatientRecordListItem> = {
  items: [recordRow],
  total: 1,
  page: 1,
  page_size: 20,
  pages: 1,
};

const detailResponse: PatientRecordResponse = {
  id: 'r1',
  patient_id: 'p1',
  appointment_id: 'a1',
  status: 'DRAFT',
  is_finalized: false,
  chief_complaint: 'Toothache',
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
  created_at: '2026-08-01T08:00:00Z',
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

const patient = {
  id: 'p1',
  patient_code: 'PAT-000001',
  full_name: 'Juan Dela Cruz',
  date_of_birth: '1990-05-15',
  age: 36,
  gender: 'male' as const,
  primary_contact_number: '+639123456789',
  emergency_contact_number: null,
  email: null,
  address: null,
  remarks: null,
  is_active: true,
  created_by: 1,
  updated_by: null,
  created_at: '2026-08-01T08:00:00Z',
  updated_at: '2026-08-01T08:00:00Z',
};

const appointment = {
  id: 'a1',
  appointment_number: 'APT-20260708-0001',
  patient_id: 'p1',
  dentist_id: 3,
  appointment_date: '2026-07-08',
  start_time: '10:00:00',
  end_time: '10:30:00',
  duration_minutes: 30,
  appointment_type: 'Consultation' as const,
  status: 'Scheduled' as const,
  reason_for_visit: 'Toothache',
  notes: null,
  created_by: 1,
  updated_by: null,
  created_at: '2026-07-07T08:00:00Z',
  updated_at: '2026-07-07T08:00:00Z',
};

describe('PatientRecordListContainer', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    listRecordsMock.mockReset();
    createRecordMock.mockReset();
    getByAppointmentMock.mockReset();
    patientListMock.mockReset();
    patientGetMock.mockReset();
    appointmentListMock.mockReset();
    appointmentGetMock.mockReset();
    userGetMock.mockReset();

    listRecordsMock.mockResolvedValue(listEnvelope);
    patientGetMock.mockResolvedValue(patient);
    appointmentGetMock.mockResolvedValue(appointment);
    // Create drawer: patient picker search + appointment options.
    patientListMock.mockResolvedValue({ items: [patient], total: 1, page: 1, page_size: 10 });
    appointmentListMock.mockResolvedValue({ items: [appointment], total: 1 });
  });

  it('renders list rows enriched with patient names', async () => {
    renderWithProviders(<PatientRecordListContainer />);

    // Patient name is resolved via GET /patients/{id}; the appointment column
    // is default-hidden in the DataTable, so only the visible columns assert.
    expect(await screen.findByText('Juan Dela Cruz')).toBeInTheDocument();
    expect(screen.getByText('Toothache')).toBeInTheDocument();
    expect(listRecordsMock).toHaveBeenCalledWith({ page: 1, page_size: 20 });
  });

  it('passes server-side filters to the list endpoint (no sort params)', async () => {
    renderWithProviders(<PatientRecordListContainer />);

    await screen.findByText('Juan Dela Cruz');

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'UNDER_REVIEW' } });
    await waitFor(() =>
      expect(listRecordsMock).toHaveBeenCalledWith({
        page: 1,
        page_size: 20,
        status: 'UNDER_REVIEW',
      }),
    );

    fireEvent.change(screen.getByLabelText('Finalized'), { target: { value: 'finalized' } });
    await waitFor(() =>
      expect(listRecordsMock).toHaveBeenCalledWith(
        expect.objectContaining({ is_finalized: true }),
      ),
    );
  });

  it('navigates to the details page when a row is clicked', async () => {
    renderWithProviders(<PatientRecordListContainer />);

    await screen.findByText('Juan Dela Cruz');
    fireEvent.click(screen.getByRole('button', { name: 'View' }));

    expect(navigateMock).toHaveBeenCalledWith('/patient-records/r1');
  });

  it('surfaces a 409 create conflict and opens the existing record via the by-appointment endpoint', async () => {
    createRecordMock.mockRejectedValue(
      httpError(409, {
        success: false,
        message: 'A record already exists for appointment a1',
      }),
    );
    getByAppointmentMock.mockResolvedValue(detailResponse);

    renderWithProviders(<PatientRecordListContainer />);
    await screen.findByText('Juan Dela Cruz');

    // Open the create drawer and pick a patient + appointment.
    fireEvent.click(screen.getByRole('button', { name: 'New Record' }));
    const dialog = screen.getByRole('dialog', { name: 'Create Patient Record' });
    expect(dialog).toBeInTheDocument();

    const pickerInput = within(dialog).getByPlaceholderText('Search patient by name or code…');
    fireEvent.change(pickerInput, { target: { value: 'juan' } });
    const patientOption = await within(dialog).findByText('Juan Dela Cruz');
    fireEvent.click(patientOption);

    const appointmentSelect = await within(dialog).findByRole('combobox', {
      name: /Appointment/,
    });
    fireEvent.change(appointmentSelect, { target: { value: 'a1' } });

    fireEvent.click(screen.getByRole('button', { name: 'Create Record' }));

    // The conflict message + View existing record action appear in the drawer.
    expect(await screen.findByText('A record already exists for appointment a1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View existing record' }));

    await waitFor(() => expect(getByAppointmentMock).toHaveBeenCalledWith('a1'));
    expect(navigateMock).toHaveBeenCalledWith('/patient-records/r1');
  });
});
