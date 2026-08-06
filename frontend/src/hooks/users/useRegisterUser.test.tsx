import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createTestQueryClient } from '../../test/testUtils';
import { useRegisterUser } from './useRegisterUser';
import { useApproveUser, pendingUsersQueryKeys } from '../auth/usePendingUsers';
import { userQueryKeys } from './useUsers';
import { authService } from '../../services/authService';

vi.mock('../../services/authService', () => ({
  authService: {
    register: vi.fn(),
    fetchPendingUsers: vi.fn(),
    approveUser: vi.fn(),
    deactivateUser: vi.fn(),
    login: vi.fn(),
    getMe: vi.fn(),
  },
}));

const registerMock = vi.mocked(authService.register);
const approveMock = vi.mocked(authService.approveUser);

/** Harness exposing the mutation + the shared QueryClient for spies. */
function createWrapper(client: ReturnType<typeof createTestQueryClient>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

// Error-state tests call `mutate()` directly (NO `act` wrapper, NO mutate
// `onError` option) — RQ v5's mutate wrapper swallows the rejected promise
// internally. This mirrors the existing `useUserMutations.test.tsx`
// convention exactly; wrapping in `act` (or passing an `onError` option)
// surfaces the rejection as an unhandled promise rejection under vitest.
describe('useRegisterUser', () => {
  it('posts the register payload and resolves with the response', async () => {
    registerMock.mockResolvedValue({
      message: 'Registration submitted. Waiting for admin approval.',
    });

    const { result } = renderHook(() => useRegisterUser(), {
      wrapper: createWrapper(createTestQueryClient()),
    });

    act(() => {
      result.current.mutate({
        full_name: 'Jane Doe',
        email: 'jane@example.com',
        password: 'Secure@Pass1',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(registerMock).toHaveBeenCalledWith({
      full_name: 'Jane Doe',
      email: 'jane@example.com',
      password: 'Secure@Pass1',
    });
    expect(result.current.data?.message).toBe(
      'Registration submitted. Waiting for admin approval.',
    );
  });

  it('surfaces a rejection (e.g. 409 duplicate email) as the mutation error', async () => {
    registerMock.mockRejectedValue(new Error('Email already registered'));

    const { result } = renderHook(() => useRegisterUser(), {
      wrapper: createWrapper(createTestQueryClient()),
    });

    result.current.mutate({
      full_name: 'Jane Doe',
      email: 'jane@example.com',
      password: 'Secure@Pass1',
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Email already registered');
  });
});

describe('useApproveUser', () => {
  it('invalidates BOTH the pending queue and the user directory on success', async () => {
    approveMock.mockResolvedValue({ message: 'User approved successfully.' });
    const client = createTestQueryClient();

    const { result } = renderHook(
      () => {
        const queryClient = useQueryClient();
        const mutation = useApproveUser();
        return { queryClient, mutation };
      },
      { wrapper: createWrapper(client) },
    );

    const invalidateSpy = vi.spyOn(result.current.queryClient, 'invalidateQueries');

    act(() => {
      result.current.mutation.mutate({ userId: 9, roleId: 3 });
    });

    await waitFor(() => expect(approveMock).toHaveBeenCalledWith(9, 3));
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: pendingUsersQueryKeys.all,
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: userQueryKeys.all,
    });
  });

  it('does not invalidate anything on failure', async () => {
    approveMock.mockRejectedValue(new Error('User is already active'));
    const client = createTestQueryClient();

    const { result } = renderHook(
      () => {
        const queryClient = useQueryClient();
        const mutation = useApproveUser();
        return { queryClient, mutation };
      },
      { wrapper: createWrapper(client) },
    );

    const invalidateSpy = vi.spyOn(result.current.queryClient, 'invalidateQueries');

    result.current.mutation.mutate({ userId: 9, roleId: 3 });

    await waitFor(() => expect(result.current.mutation.isError).toBe(true));
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
