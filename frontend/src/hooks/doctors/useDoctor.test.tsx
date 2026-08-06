import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { doctorService } from '../../services/doctorService';
import { useDoctor } from './useDoctor';
import type { DoctorResponse } from '../../types/doctor';

vi.mock('../../services/doctorService', () => ({
  doctorService: {
    get: vi.fn(),
  },
}));

const getMock = vi.mocked(doctorService.get);

const doctor: DoctorResponse = {
  id: 'd1',
  doctor_code: 'DOC-00001',
  user_id: 3,
  user_full_name: 'Dr. Jose Rizal',
  user_email: 'jose@clinic.com',
  date_of_birth: null,
  gender: null,
  primary_phone: '+639171234567',
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
  available_for_appointment: true,
  on_leave: false,
  is_active: true,
  specializations: [],
  created_by: null,
  updated_by: null,
  created_at: '2026-07-07T10:00:00Z',
  updated_at: '2026-07-07T10:00:00Z',
};

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false, gcTime: Infinity, staleTime: Infinity },
    },
  });
}

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useDoctor', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('fetches a single doctor when an id is provided', async () => {
    getMock.mockResolvedValue(doctor);
    const queryClient = createQueryClient();

    const { result } = renderHook(() => useDoctor('d1'), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(result.current.data).toEqual(doctor));
    expect(getMock).toHaveBeenCalledWith('d1');
  });

  it('does not fetch while disabled or when the id is missing', () => {
    getMock.mockResolvedValue(doctor);
    const queryClient = createQueryClient();

    renderHook(() => useDoctor(null), { wrapper: makeWrapper(queryClient) });
    expect(getMock).not.toHaveBeenCalled();

    renderHook(() => useDoctor('d1', false), { wrapper: makeWrapper(queryClient) });
    expect(getMock).not.toHaveBeenCalled();
  });
});
