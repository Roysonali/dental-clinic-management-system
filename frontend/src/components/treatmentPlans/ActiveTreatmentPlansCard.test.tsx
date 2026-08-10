import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiosError, type InternalAxiosRequestConfig, type AxiosResponse } from 'axios';
import { QueryClient } from '@tanstack/react-query';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/testUtils';
import { ActiveTreatmentPlansCard } from './ActiveTreatmentPlansCard';
import { doctorService } from '../../services/doctorService';
import { treatmentPlanService } from '../../services/treatmentPlanService';
import type { AuthContextValue } from '../../context/auth/authContext';
import type { TreatmentPlanListItem } from '../../types/treatmentPlan';

const authMock: AuthContextValue = {
  token: 'token',
  user: { id: 3, full_name: 'Dr. X', email: 'x@clinic.com', status: 'active' },
  isAuthenticated: true,
  isInitializing: false,
  login: vi.fn(async () => {}),
  logout: vi.fn(),
  refreshUser: vi.fn(),
};

vi.mock('../../hooks/auth/useAuth', () => ({
  useAuth: () => authMock,
}));

vi.mock('../../services/doctorService', () => ({
  doctorService: { getByUserId: vi.fn() },
}));

vi.mock('../../services/treatmentPlanService', () => ({
  treatmentPlanService: { listByDoctor: vi.fn() },
}));

const getByUserIdMock = vi.mocked(doctorService.getByUserId);
const listByDoctorMock = vi.mocked(treatmentPlanService.listByDoctor);

const config: InternalAxiosRequestConfig = {} as InternalAxiosRequestConfig;

function httpError(status: number, message: string): AxiosError {
  const response = {
    status,
    statusText: '',
    headers: {},
    config,
    data: { success: false, message },
  } as AxiosResponse;
  return new AxiosError(
    `Request failed with status code ${status}`,
    'ERR_BAD_REQUEST',
    config,
    undefined,
    response,
  );
}

const doctor = {
  id: 'd1',
  doctor_code: 'DOC-0001',
  user_id: 3,
  user_full_name: 'Dr. X',
  user_email: null,
};

const plan: TreatmentPlanListItem = {
  id: 'tp-1',
  plan_code: 'PLN-0001',
  patient_id: 'p1',
  doctor_id: 'd1',
  status: 'in_progress',
  current_version: 1,
  is_active: true,
  created_by: 3,
  created_at: '2026-07-01T08:00:00Z',
  updated_at: '2026-07-05T08:00:00Z',
  item_count: 3,
  total_estimated_cost: 4500,
};

const SKELETON_SELECTOR = '.animate-pulse, [data-skeleton="true"]';

describe('ActiveTreatmentPlansCard', () => {
  beforeEach(() => {
    getByUserIdMock.mockReset();
    listByDoctorMock.mockReset();
  });

  it('shows the loading skeleton while the doctor lookup is pending', () => {
    getByUserIdMock.mockReturnValue(new Promise(() => {}));

    renderWithProviders(<ActiveTreatmentPlansCard />);

    expect(document.querySelectorAll(SKELETON_SELECTOR).length).toBeGreaterThan(0);
  });

  it('renders the doctor\'s active treatment plans after both queries resolve', async () => {
    getByUserIdMock.mockResolvedValue(doctor);
    listByDoctorMock.mockResolvedValue({
      items: [plan],
      total: 1,
      page: 1,
      page_size: 5,
      total_pages: 1,
    });

    renderWithProviders(<ActiveTreatmentPlansCard />);

    expect(await screen.findByText('PLN-0001')).toBeInTheDocument();
    expect(screen.getByText(/Patient #p1/)).toBeInTheDocument();
    expect(listByDoctorMock).toHaveBeenCalledWith('d1', {
      page: 1,
      page_size: 5,
      is_active: true,
    });
  });

  it('renders the empty state when the doctor has no active plans', async () => {
    getByUserIdMock.mockResolvedValue(doctor);
    listByDoctorMock.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 5,
      total_pages: 0,
    });

    renderWithProviders(<ActiveTreatmentPlansCard />);

    expect(await screen.findByText('No active treatment plans')).toBeInTheDocument();
    expect(document.querySelectorAll(SKELETON_SELECTOR).length).toBe(0);
  });

  it('renders the empty state (not an infinite skeleton) when the user is not a doctor (404)', async () => {
    // Backend raises DoctorNotFound for accounts without a doctor profile
    // (admin/receptionist/dental assistant). The plans query never fires.
    getByUserIdMock.mockRejectedValue(httpError(404, 'Doctor profile not found'));

    renderWithProviders(<ActiveTreatmentPlansCard />);

    expect(await screen.findByText('No active treatment plans')).toBeInTheDocument();
    expect(listByDoctorMock).not.toHaveBeenCalled();
    expect(document.querySelectorAll(SKELETON_SELECTOR).length).toBe(0);
  });

  it('renders an error state with retry when the doctor lookup fails (5xx)', async () => {
    getByUserIdMock.mockRejectedValue(httpError(500, 'boom'));

    // The widget's retry predicate keeps the single retry for 5xx — use a
    // zero-delay client so both attempts settle deterministically.
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, retryDelay: 0, gcTime: Infinity, staleTime: Infinity },
      },
    });
    renderWithProviders(<ActiveTreatmentPlansCard />, { queryClient });

    expect(
      await screen.findByText("Couldn't load your treatment plans"),
    ).toBeInTheDocument();
    expect(screen.getByText('boom')).toBeInTheDocument();

    // Retry recovers once the lookup succeeds and the plans load.
    getByUserIdMock.mockResolvedValue(doctor);
    listByDoctorMock.mockResolvedValue({
      items: [plan],
      total: 1,
      page: 1,
      page_size: 5,
      total_pages: 1,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('PLN-0001')).toBeInTheDocument();
  });

  it('renders an error state with retry when the plans fetch fails', async () => {
    getByUserIdMock.mockResolvedValue(doctor);
    listByDoctorMock.mockRejectedValue(httpError(500, 'plans boom'));

    renderWithProviders(<ActiveTreatmentPlansCard />);

    expect(
      await screen.findByText("Couldn't load your treatment plans"),
    ).toBeInTheDocument();
    expect(screen.getByText('plans boom')).toBeInTheDocument();
    expect(document.querySelectorAll(SKELETON_SELECTOR).length).toBe(0);

    // Retry refetches the plans.
    listByDoctorMock.mockResolvedValue({
      items: [plan],
      total: 1,
      page: 1,
      page_size: 5,
      total_pages: 1,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => {
      expect(listByDoctorMock).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText('PLN-0001')).toBeInTheDocument();
  });

  it('never remains in a loading state after a failed request settles', async () => {
    // Doctor lookup 403 (expected for cross-role reads) → must NOT skeleton.
    getByUserIdMock.mockRejectedValue(httpError(403, 'Forbidden'));

    renderWithProviders(<ActiveTreatmentPlansCard />);

    await screen.findByText("Couldn't load your treatment plans");
    expect(document.querySelectorAll(SKELETON_SELECTOR).length).toBe(0);
  });
});
