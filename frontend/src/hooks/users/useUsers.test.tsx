import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { userService } from '../../services/userService';
import { useUsers, userQueryKeys } from './useUsers';
import type { UserListParams, UserListResponse } from '../../types/user';

vi.mock('../../services/userService', () => ({
  userService: {
    list: vi.fn(),
  },
}));

const listMock = vi.mocked(userService.list);

const listResponse: UserListResponse = {
  items: [
    {
      id: 3,
      full_name: 'Dr. Jose Rizal',
      email: 'jose@clinic.com',
      status: 'active',
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

describe('userQueryKeys', () => {
  it('encodes every list param into the cache key', () => {
    expect(userQueryKeys.list({ page: 2, page_size: 25, search: 'reyes', status: 'active', role_id: 3 })).toEqual([
      'users',
      'list',
      2,
      25,
      'reyes',
      'active',
      3,
    ]);
  });

  it('uses backend defaults when params are omitted', () => {
    expect(userQueryKeys.list()).toEqual(['users', 'list', 1, 10, '', 'all', 'all']);
  });

  it('exposes all/detail/search keys used for invalidation', () => {
    expect(userQueryKeys.all).toEqual(['users']);
    expect(userQueryKeys.detail(3)).toEqual(['users', 'detail', 3]);
    expect(userQueryKeys.search('mar')).toEqual(['users', 'search', 'mar']);
  });
});

describe('useUsers', () => {
  beforeEach(() => {
    listMock.mockReset();
  });

  it('fetches GET /users with the given params', async () => {
    listMock.mockResolvedValue(listResponse);
    const queryClient = createQueryClient();
    const params: UserListParams = { page: 2, page_size: 25, search: 'reyes', status: 'active', role_id: 3 };

    renderHook(() => useUsers(params), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(1));
    expect(listMock).toHaveBeenCalledWith(params);
  });

  it('defaults to an empty params object (backend defaults)', async () => {
    listMock.mockResolvedValue(listResponse);
    const queryClient = createQueryClient();

    renderHook(() => useUsers(), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(listMock).toHaveBeenCalledWith({}));
  });

  it('does not fetch while disabled', () => {
    listMock.mockResolvedValue(listResponse);
    const queryClient = createQueryClient();

    renderHook(() => useUsers({}, false), { wrapper: makeWrapper(queryClient) });

    expect(listMock).not.toHaveBeenCalled();
  });

  it('exposes the resolved list data', async () => {
    listMock.mockResolvedValue(listResponse);
    const queryClient = createQueryClient();

    const { result } = renderHook(() => useUsers({}), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(result.current.data).toEqual(listResponse));
  });

  it('keeps previous data while re-fetching (keepPreviousData)', async () => {
    const firstPage = { ...listResponse, page: 1 };
    const secondPage = { ...listResponse, page: 2 };
    listMock.mockResolvedValueOnce(firstPage).mockResolvedValue(secondPage);
    const queryClient = createQueryClient();

    const { result, rerender } = renderHook(({ page }) => useUsers({ page }), {
      wrapper: makeWrapper(queryClient),
      initialProps: { page: 1 },
    });

    await waitFor(() => expect(result.current.data).toEqual(firstPage));
    rerender({ page: 2 });

    // Previous data is still served synchronously while page 2 loads.
    expect(result.current.data).toEqual(firstPage);
    await waitFor(() => expect(result.current.data).toEqual(secondPage));
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

    const { result } = renderHook(() => useUsers({}), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(listMock).toHaveBeenCalledTimes(1);
  });
});
