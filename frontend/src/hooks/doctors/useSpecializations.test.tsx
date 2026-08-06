import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { doctorService } from '../../services/doctorService';
import { useSpecializations } from './useSpecializations';

vi.mock('../../services/doctorService', () => ({
  doctorService: {
    listSpecializations: vi.fn(),
  },
}));

const listSpecializationsMock = vi.mocked(doctorService.listSpecializations);

const response = {
  items: [{ id: 1, name: 'Orthodontics', code: 'ORTHO', description: null, is_active: true }],
  total: 1,
  page: 1,
  page_size: 20,
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

describe('useSpecializations', () => {
  beforeEach(() => {
    listSpecializationsMock.mockReset();
  });

  it('fetches specializations with the given params', async () => {
    listSpecializationsMock.mockResolvedValue(response);
    const queryClient = createQueryClient();
    const params = { is_active: true };

    const { result } = renderHook(() => useSpecializations(params), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(result.current.data).toEqual(response));
    expect(listSpecializationsMock).toHaveBeenCalledWith(params);
  });

  it('does not fetch while disabled', () => {
    listSpecializationsMock.mockResolvedValue(response);
    const queryClient = createQueryClient();

    renderHook(() => useSpecializations({}, false), { wrapper: makeWrapper(queryClient) });

    expect(listSpecializationsMock).not.toHaveBeenCalled();
  });
});
