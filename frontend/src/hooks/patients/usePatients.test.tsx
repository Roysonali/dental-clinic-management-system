import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { createTestQueryClient } from '../../test/testUtils';
import { usePatients } from './usePatients';
import { patientService } from '../../services/patientService';
import type { PatientListResponse } from '../../types/patient';

vi.mock('../../services/patientService', () => ({
  patientService: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    activate: vi.fn(),
    deactivate: vi.fn(),
  },
}));

const listMock = vi.mocked(patientService.list);

const response: PatientListResponse = {
  items: [
    {
      id: 'p1',
      patient_code: 'PAT-000001',
      full_name: 'Juan Dela Cruz',
      age: 34,
      gender: 'male',
      primary_contact_number: '+639123456789',
      is_active: true,
    },
  ],
  total: 1,
  page: 1,
  page_size: 20,
};

describe('usePatients', () => {
  beforeEach(() => {
    listMock.mockReset();
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

  it('calls the patient service with the given params', async () => {
    listMock.mockResolvedValue(response);
    const queryClient = createTestQueryClient();

    const { result } = renderHook(
      () => usePatients({ page: 2, page_size: 20, search: 'juan', is_active: true }),
      { wrapper: makeWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.data).toEqual(response));
    expect(listMock).toHaveBeenCalledWith({
      page: 2,
      page_size: 20,
      search: 'juan',
      is_active: true,
    });
  });

  it('refetches when the search parameter changes', async () => {
    listMock.mockResolvedValue(response);
    const queryClient = createTestQueryClient();

    const { result, rerender } = renderHook(
      ({ search }: { search: string }) => usePatients({ page: 1, page_size: 20, search }),
      {
        wrapper: makeWrapper(queryClient),
        initialProps: { search: 'juan' },
      },
    );

    await waitFor(() => expect(result.current.data).toEqual(response));
    expect(listMock).toHaveBeenCalledTimes(1);

    rerender({ search: 'maria' });
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2));
    expect(listMock).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'maria' }));
  });

  it('exposes isLoading while the query is pending', () => {
    listMock.mockReturnValue(new Promise(() => {})); // never resolves
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => usePatients({ page: 1, page_size: 20 }), {
      wrapper: makeWrapper(queryClient),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });
});
