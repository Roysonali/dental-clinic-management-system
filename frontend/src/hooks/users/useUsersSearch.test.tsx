import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { userService } from '../../services/userService';
import { useUsersSearch } from './useUsersSearch';

vi.mock('../../services/userService', () => ({
  userService: {
    list: vi.fn(),
  },
}));

const listMock = vi.mocked(userService.list);

const response = {
  items: [
    {
      id: 3,
      full_name: 'Dr. Jose Rizal',
      email: 'jose@clinic.com',
      status: 'active' as const,
      is_active: true,
      role_id: 3,
      role_name: 'GENERAL_DOCTOR',
      last_login_at: null,
      created_at: null,
    },
  ],
  total: 1,
  page: 1,
  page_size: 10,
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

describe('useUsersSearch', () => {
  beforeEach(() => {
    listMock.mockReset();
  });

  it('queries GET /users with the trimmed search term and default page size', async () => {
    listMock.mockResolvedValue(response);
    const queryClient = createQueryClient();

    const { result } = renderHook(() => useUsersSearch('  mar  '), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(result.current.data).toEqual(response));
    expect(listMock).toHaveBeenCalledWith({ search: 'mar', page: 1, page_size: 10 });
  });

  it('omits the search param when the term is empty (initial page)', async () => {
    listMock.mockResolvedValue(response);
    const queryClient = createQueryClient();

    renderHook(() => useUsersSearch(''), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(listMock).toHaveBeenCalled());
    expect(listMock).toHaveBeenCalledWith({ search: undefined, page: 1, page_size: 10 });
  });

  it('does not fetch while disabled', () => {
    listMock.mockResolvedValue(response);
    const queryClient = createQueryClient();

    renderHook(() => useUsersSearch('mar', false), { wrapper: makeWrapper(queryClient) });

    expect(listMock).not.toHaveBeenCalled();
  });

  it('does not retry a 403 (ADMIN-only endpoint, shouldRetryQuery)', async () => {
    const config = {} as InternalAxiosRequestConfig;
    const axiosResponse = {
      data: { success: false, message: 'Insufficient permissions' },
      status: 403,
      statusText: 'Forbidden',
      headers: {},
      config,
    } as AxiosResponse;
    listMock.mockRejectedValue(
      new AxiosError('Request failed with status code 403', 'ERR_BAD_REQUEST', config, undefined, axiosResponse),
    );
    const queryClient = createQueryClient();

    const { result } = renderHook(() => useUsersSearch('mar'), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(result.current.isError).toBe(true));
    // 403 is non-retryable → exactly one request.
    expect(listMock).toHaveBeenCalledTimes(1);
  });
});
