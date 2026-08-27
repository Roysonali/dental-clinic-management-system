import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { createTestQueryClient } from '../../test/testUtils';
import { useAppointmentNames } from './useAppointmentNames';
import { patientService } from '../../services/patientService';
import { doctorService } from '../../services/doctorService';

vi.mock('../../services/patientService', () => ({
  patientService: { list: vi.fn(), get: vi.fn() },
}));

vi.mock('../../services/doctorService', () => ({
  doctorService: { list: vi.fn(), getByUserId: vi.fn() },
}));

const patientGetMock = vi.mocked(patientService.get);
const doctorGetMock = vi.mocked(doctorService.getByUserId);

describe('useAppointmentNames', () => {
  beforeEach(() => {
    patientGetMock.mockReset();
    doctorGetMock.mockReset();
  });

  function makeWrapper(queryClient: QueryClient) {
    return function Wrapper({ children }: { children: ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>{children}</MemoryRouter>
        </QueryClientProvider>
      );
    };
  }

  it('resolves patient and dentist display names', async () => {
    patientGetMock.mockResolvedValue({
      id: 'p1',
      patient_code: 'PAT-000001',
      first_name: 'Juan',
      middle_name: null,
      last_name: 'Dela Cruz',
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
    const queryClient = createTestQueryClient();

    const { result } = renderHook(
      () => useAppointmentNames(['p1'], [3]),
      { wrapper: makeWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.patientNames.get('p1')).toBe('Juan Dela Cruz');
    expect(result.current.data?.dentistNames.get(3)).toBe('Dr. Jose Rizal');
  });

  it('deduplicates repeated ids into a single request each', async () => {
    patientGetMock.mockResolvedValue({
      id: 'p1',
      patient_code: 'PAT-000001',
      first_name: 'Juan',
      middle_name: null,
      last_name: 'Dela Cruz',
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
    const queryClient = createTestQueryClient();

    const { result } = renderHook(
      () => useAppointmentNames(['p1', 'p1', 'p1'], [3, 3]),
      { wrapper: makeWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(patientGetMock).toHaveBeenCalledTimes(1);
    expect(doctorGetMock).toHaveBeenCalledTimes(1);
  });

  it('maps per-id failures to null instead of failing the query', async () => {
    patientGetMock.mockRejectedValue(new Error('404'));
    doctorGetMock.mockRejectedValue(new Error('403'));
    const queryClient = createTestQueryClient();

    const { result } = renderHook(
      () => useAppointmentNames(['p1', 'p2'], [3, 4]),
      { wrapper: makeWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.patientNames.get('p1')).toBeNull();
    expect(result.current.data?.dentistNames.get(3)).toBeNull();
  });

  it('keeps patient and dentist id-lists namespaced (no cross-type collision)', async () => {
    // A patient id string '3' and a dentist id number 3 must resolve as
    // SEPARATE queries — the namespaced key ({patients, dentists}) guarantees
    // a future identifier-type change can never merge the two lists.
    patientGetMock.mockResolvedValue({
      id: '3',
      patient_code: 'PAT-000003',
      first_name: 'Patient',
      middle_name: null,
      last_name: 'Three',
      full_name: 'Patient Three',
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
      id: 'd3',
      doctor_code: 'DOC-00003',
      user_id: 3,
      user_full_name: 'Dr. Three',
      user_email: 'three@clinic.com',
    });
    const queryClient = createTestQueryClient();

    const { result: patientOnly } = renderHook(
      () => useAppointmentNames(['3'], []),
      { wrapper: makeWrapper(queryClient) },
    );
    const { result: dentistOnly } = renderHook(
      () => useAppointmentNames([], [3]),
      { wrapper: makeWrapper(queryClient) },
    );

    await waitFor(() => expect(patientOnly.current.isSuccess).toBe(true));
    await waitFor(() => expect(dentistOnly.current.isSuccess).toBe(true));

    // The patient-only query resolves the patient and NOT the dentist, and
    // vice-versa — proving the two key spaces never collide.
    expect(patientOnly.current.data?.patientNames.get('3')).toBe('Patient Three');
    expect(patientOnly.current.data?.dentistNames.size).toBe(0);
    expect(dentistOnly.current.data?.dentistNames.get(3)).toBe('Dr. Three');
    expect(dentistOnly.current.data?.patientNames.size).toBe(0);
  });

  it('is disabled when no ids are provided', () => {
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useAppointmentNames([], []), {
      wrapper: makeWrapper(queryClient),
    });

    expect(result.current.isPending).toBe(true);
    expect(patientGetMock).not.toHaveBeenCalled();
  });
});
