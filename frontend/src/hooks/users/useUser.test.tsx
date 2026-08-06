import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { userService } from '../../services/userService';
import { useUser } from './useUser';
import type { UserDetailResponse } from '../../types/user';

vi.mock('../../services/userService', () => ({
  userService: {
    get: vi.fn(),
  },
}));

const getMock = vi.mocked(userService.get);

const detail: UserDetailResponse = {
  id: 3,
  full_name: 'Dr. Jose Rizal',
  email: 'jose@clinic.com',
  status: 'active',
  is_active: true,
  role_id: 3,
  role_name: 'GENERAL_DOCTOR',
  last_login_at: null,
  created_by: 1,
  created_at: '2026-07-01T08:00:00Z',
  updated_at: null,
  updated_by: null,
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

describe('useUser', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('fetches GET /users/{id} for a numeric id', async () => {
    getMock.mockResolvedValue(detail);
    const queryClient = createQueryClient();

    renderHook(() => useUser(3), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(getMock).toHaveBeenCalledWith(3));
  });

  it('does not fetch until an id is available', () => {
    getMock.mockResolvedValue(detail);
    const queryClient = createQueryClient();

    renderHook(() => useUser(null), { wrapper: makeWrapper(queryClient) });

    expect(getMock).not.toHaveBeenCalled();
  });

  it('does not fetch while explicitly disabled', () => {
    getMock.mockResolvedValue(detail);
    const queryClient = createQueryClient();

    renderHook(() => useUser(3, false), { wrapper: makeWrapper(queryClient) });

    expect(getMock).not.toHaveBeenCalled();
  });

  it('exposes the resolved detail record', async () => {
    getMock.mockResolvedValue(detail);
    const queryClient = createQueryClient();

    const { result } = renderHook(() => useUser(3), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(result.current.data).toEqual(detail));
  });
});
