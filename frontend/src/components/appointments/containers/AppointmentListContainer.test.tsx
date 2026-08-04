import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiosError, type InternalAxiosRequestConfig, type AxiosResponse } from 'axios';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../../test/testUtils';
import { AppointmentListContainer } from './AppointmentListContainer';
import { appointmentService } from '../../../services/appointmentService';
import { patientService } from '../../../services/patientService';
import { doctorService } from '../../../services/doctorService';
import type { AppointmentListResponse, AppointmentResponse } from '../../../types/appointment';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('../../../services/appointmentService', () => ({
  appointmentService: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    cancel: vi.fn(),
    today: vi.fn(),
  },
}));

vi.mock('../../../services/patientService', () => ({
  patientService: { list: vi.fn(), get: vi.fn() },
}));

vi.mock('../../../services/doctorService', () => ({
  doctorService: { list: vi.fn(), getByUserId: vi.fn() },
}));

const listMock = vi.mocked(appointmentService.list);
const cancelMock = vi.mocked(appointmentService.cancel);
const patientGetMock = vi.mocked(patientService.get);
const doctorListMock = vi.mocked(doctorService.list);
const doctorGetMock = vi.mocked(doctorService.getByUserId);

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

const makeAppointment = (id: string, status: AppointmentResponse['status']): AppointmentResponse => ({
  id,
  appointment_number: `APT-20260707-${id}`,
  patient_id: 'p1',
  dentist_id: 3,
  appointment_date: '2026-07-08',
  start_time: '10:00:00',
  end_time: '10:30:00',
  duration_minutes: 30,
  appointment_type: 'Consultation',
  status,
  reason_for_visit: 'Toothache',
  notes: null,
  created_by: 1,
  updated_by: null,
  created_at: '2026-07-07T08:00:00Z',
  updated_at: '2026-07-07T08:00:00Z',
});

const makeResponse = (total: number): AppointmentListResponse => ({
  items: [makeAppointment('0001', 'Scheduled'), makeAppointment('0002', 'Completed')],
  total,
});

describe('AppointmentListContainer', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    listMock.mockReset();
    cancelMock.mockReset();
    patientGetMock.mockReset();
    doctorListMock.mockReset();
    doctorGetMock.mockReset();

    listMock.mockResolvedValue(makeResponse(2));
    patientGetMock.mockResolvedValue({
      id: 'p1',
      patient_code: 'PAT-000001',
      full_name: 'Juan Dela Cruz',
      date_of_birth: '1990-05-15',
      age: 36,
      gender: 'male',
      primary_contact_number: '+639123456789',
      emergency_contact_number: null,
      email: null,
      address: null,
      remarks: null,
      is_active: true,
      created_by: 1,
      updated_by: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });
    doctorGetMock.mockResolvedValue({
      id: 'd1',
      doctor_code: 'DOC-00001',
      user_id: 3,
      user_full_name: 'Dr. Jose Rizal',
      user_email: 'jose@clinic.com',
    });
    doctorListMock.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 100 });
  });

  it('renders appointments fetched from the service', async () => {
    renderWithProviders(<AppointmentListContainer />);

    await waitFor(() => {
      expect(screen.getByText('APT-20260707-0001')).toBeInTheDocument();
      expect(screen.getByText('APT-20260707-0002')).toBeInTheDocument();
    });
    expect(listMock).toHaveBeenCalledWith({ skip: 0, limit: 20 });
  });

  it('paginates through results', async () => {
    listMock.mockResolvedValue(makeResponse(45));
    renderWithProviders(<AppointmentListContainer />);

    await waitFor(() => expect(screen.getByText('APT-20260707-0001')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() =>
      expect(listMock).toHaveBeenCalledWith({ skip: 20, limit: 20 }),
    );
  });

  it('opens the New Appointment drawer', async () => {
    renderWithProviders(<AppointmentListContainer />);

    await waitFor(() => expect(screen.getByText('APT-20260707-0001')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'New Appointment' }));

    expect(screen.getByRole('dialog', { name: 'New Appointment' })).toBeInTheDocument();
  });

  it('navigates to the details page on row view', async () => {
    renderWithProviders(<AppointmentListContainer />);

    await waitFor(() => expect(screen.getByText('APT-20260707-0001')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'View APT-20260707-0001' }));

    expect(navigateMock).toHaveBeenCalledWith('/appointments/0001');
  });

  it('opens the cancel dialog and confirms the cancellation', async () => {
    cancelMock.mockResolvedValue(makeAppointment('0001', 'Cancelled'));
    renderWithProviders(<AppointmentListContainer />);

    await waitFor(() => expect(screen.getByText('APT-20260707-0001')).toBeInTheDocument());

    // Only the Scheduled row (0001) shows a cancel action.
    fireEvent.click(screen.getByRole('button', { name: 'Cancel APT-20260707-0001' }));
    expect(screen.getByRole('dialog', { name: 'Cancel appointment' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Yes, Cancel Appointment' }));
    await waitFor(() => expect(cancelMock).toHaveBeenCalledWith('0001'));
  });

  it('shows the results summary computed from the total in the footer', async () => {
    listMock.mockResolvedValue(makeResponse(45));
    renderWithProviders(<AppointmentListContainer />);

    await waitFor(() => expect(screen.getByText('APT-20260707-0001')).toBeInTheDocument());
    // Footer summary (Pagination) reflects the backend total (45). The "1–20 of "
    // segment lives in a child span, so match on the paragraph's full text.
    expect(
      screen.getByText((_content, node) => node?.textContent === '1–20 of 45 results'),
    ).toBeInTheDocument();
  });

  it('offers a rows-per-page selector in the footer', async () => {
    listMock.mockResolvedValue(makeResponse(45));
    renderWithProviders(<AppointmentListContainer />);

    await waitFor(() => expect(screen.getByText('APT-20260707-0001')).toBeInTheDocument());

    const rowsPerPage = screen.getByLabelText('Rows per page');
    expect(rowsPerPage).toBeInTheDocument();
    fireEvent.change(rowsPerPage, { target: { value: '50' } });

    await waitFor(() =>
      expect(listMock).toHaveBeenCalledWith({ skip: 0, limit: 50 }),
    );
  });

  it('filters rows client-side by search input', async () => {
    listMock.mockResolvedValue(makeResponse(2));
    renderWithProviders(<AppointmentListContainer />);

    await waitFor(() => expect(screen.getByText('APT-20260707-0001')).toBeInTheDocument());

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search appointments...' }), {
      target: { value: '0002' },
    });

    await waitFor(() => {
      expect(screen.queryByText('APT-20260707-0001')).not.toBeInTheDocument();
      expect(screen.getByText('APT-20260707-0002')).toBeInTheDocument();
    });
  });

  it('hides the footer pagination while a filter is active', async () => {
    listMock.mockResolvedValue(makeResponse(45));
    renderWithProviders(<AppointmentListContainer />);

    await waitFor(() => expect(screen.getByText('APT-20260707-0001')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Next page' })).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by status' }), {
      target: { value: 'Completed' },
    });

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Next page' })).not.toBeInTheDocument();
    });
  });

  it('shows a friendly session-expired message for 401 errors', async () => {
    listMock.mockRejectedValue(httpError(401, { message: 'Not authenticated' }));
    renderWithProviders(<AppointmentListContainer />);

    await waitFor(() => {
      expect(
        screen.getByText('Your session has expired. Please sign in again.'),
      ).toBeInTheDocument();
    });
    // The raw backend detail is not shown.
    expect(screen.queryByText('Not authenticated')).not.toBeInTheDocument();
  });

  it('filters rows client-side by status', async () => {
    listMock.mockResolvedValue(makeResponse(2));
    renderWithProviders(<AppointmentListContainer />);

    await waitFor(() => expect(screen.getByText('APT-20260707-0001')).toBeInTheDocument());

    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by status' }), {
      target: { value: 'Completed' },
    });

    await waitFor(() => {
      expect(screen.queryByText('APT-20260707-0001')).not.toBeInTheDocument();
      expect(screen.getByText('APT-20260707-0002')).toBeInTheDocument();
    });
  });

  it('renders a full-width error panel for backend failures', async () => {
    listMock.mockRejectedValue(
      new Error('Request failed with status code 500'),
    );
    renderWithProviders(<AppointmentListContainer />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load data')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
