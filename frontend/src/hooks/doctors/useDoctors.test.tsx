import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { doctorService } from '../../services/doctorService';
import { useDoctors } from './useDoctors';

vi.mock('../../services/doctorService', () => ({
  doctorService: {
    list: vi.fn(),
  },
}));

const listMock = vi.mocked(doctorService.list);

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
        gcTime: Infinity,
        staleTime: Infinity,
      },
    },
  });
}

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const listResponse = {
  items: [],
  total: 0,
  page: 1,
  page_size: 20,
};

describe('useDoctors', () => {
  beforeEach(() => {
    listMock.mockReset();
  });

  it('supports the legacy appointment signature useDoctors(enabled) with dropdown params', async () => {
    listMock.mockResolvedValue(listResponse);
    const queryClient = createQueryClient();

    renderHook(() => useDoctors(true), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(1));
    expect(listMock).toHaveBeenCalledWith({ page: 1, page_size: 100, is_available: true });
  });

  it('does not fetch while the legacy enabled flag is false', () => {
    listMock.mockResolvedValue(listResponse);
    const queryClient = createQueryClient();

    renderHook(() => useDoctors(false), { wrapper: makeWrapper(queryClient) });

    expect(listMock).not.toHaveBeenCalled();
  });

  it('accepts explicit list params (module list page)', async () => {
    listMock.mockResolvedValue(listResponse);
    const queryClient = createQueryClient();
    const params = { page: 2, page_size: 50, search: 'rizal', is_available: true };

    renderHook(() => useDoctors(params, true), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(1));
    expect(listMock).toHaveBeenCalledWith(params);
  });

  it('exposes the resolved list data', async () => {
    listMock.mockResolvedValue(listResponse);
    const queryClient = createQueryClient();

    const { result } = renderHook(() => useDoctors(true), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(result.current.data).toEqual(listResponse));
  });
});
