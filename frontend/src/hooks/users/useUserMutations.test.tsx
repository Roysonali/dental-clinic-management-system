import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { userService } from '../../services/userService';
import {
  useActivateUser,
  useChangeUserRole,
  useDeactivateUser,
} from './useUserMutations';
import { useUsers } from './useUsers';
import { usePendingUsers } from '../auth/usePendingUsers';
import type { UserActionResponse } from '../../types/user';

vi.mock('../../services/userService', () => ({
  userService: {
    list: vi.fn(),
    get: vi.fn(),
    changeRole: vi.fn(),
    activate: vi.fn(),
    deactivate: vi.fn(),
  },
}));

vi.mock('../auth/usePendingUsers', () => ({
  pendingUsersQueryKeys: { all: ['auth', 'pending-users'] as const },
  usePendingUsers: vi.fn(),
}));

const listMock = vi.mocked(userService.list);
const changeRoleMock = vi.mocked(userService.changeRole);
const activateMock = vi.mocked(userService.activate);
const deactivateMock = vi.mocked(userService.deactivate);

const action: UserActionResponse = { user_id: 3, message: 'Role updated successfully' };

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

/** Harness: mounts the user list + pending-users queries alongside one mutation. */
function Harness() {
  const users = useUsers({ page: 1 });
  const pending = usePendingUsers();
  const changeRole = useChangeUserRole();
  return (
    <div>
      <span data-testid="count">{users.data?.total ?? -1}</span>
      <span data-testid="pending-count">{pending.data?.length ?? -1}</span>
      <button onClick={() => changeRole.mutate({ userId: 3, roleId: 5 })}>change-role</button>
    </div>
  );
}

describe('useUserMutations', () => {
  beforeEach(() => {
    listMock.mockReset();
    changeRoleMock.mockReset();
    activateMock.mockReset();
    deactivateMock.mockReset();
    // Default return value so harnesses that mount usePendingUsers render
    // without throwing (the hook itself is fully mocked in this suite).
    vi.mocked(usePendingUsers).mockReturnValue({ data: [] } as never);
  });

  it('useChangeUserRole calls changeRole with userId + roleId and invalidates the user directory (refetch)', async () => {
    listMock.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 10 });
    changeRoleMock.mockResolvedValue(action);
    const queryClient = createQueryClient();

    const user = userEvent.setup();
    render(<Harness />, { wrapper: makeWrapper(queryClient) });
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('0'));
    const callsBeforeMutation = listMock.mock.calls.length;

    await user.click(screen.getByRole('button', { name: 'change-role' }));

    expect(changeRoleMock).toHaveBeenCalledWith(3, 5);
    await waitFor(() =>
      expect(listMock.mock.calls.length).toBeGreaterThan(callsBeforeMutation),
    );
  });

  it('useActivateUser calls activate(id)', async () => {
    activateMock.mockResolvedValue({ user_id: 3, message: 'User activated successfully' });
    const queryClient = createQueryClient();

    const { result } = renderHook(() => useActivateUser(), { wrapper: makeWrapper(queryClient) });
    result.current.mutate(3);

    await waitFor(() => expect(activateMock).toHaveBeenCalledWith(3));
  });

  it('useDeactivateUser calls deactivate(id)', async () => {
    deactivateMock.mockResolvedValue({ user_id: 3, message: 'User deactivated successfully' });
    const queryClient = createQueryClient();

    const { result } = renderHook(() => useDeactivateUser(), { wrapper: makeWrapper(queryClient) });
    result.current.mutate(3);

    await waitFor(() => expect(deactivateMock).toHaveBeenCalledWith(3));
  });

  it('activate/deactivate also invalidate the admin pending-approval list (status moves users across lists)', async () => {
    listMock.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 10 });
    vi.mocked(usePendingUsers).mockReturnValue({
      data: [{ id: 3, full_name: 'Maria Clara', email: 'maria@t.com', status: 'pending' }],
    } as never);
    activateMock.mockResolvedValue({ user_id: 3, message: 'User activated successfully' });
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const user = userEvent.setup();
    const ActivateHarness = () => {
      const users = useUsers({ page: 1 });
      const pending = usePendingUsers();
      const activate = useActivateUser();
      return (
        <div>
          <span data-testid="count">{users.data?.total ?? -1}</span>
          <span data-testid="pending-count">{pending.data?.length ?? -1}</span>
          <button onClick={() => activate.mutate(3)}>activate</button>
        </div>
      );
    };
    render(<ActivateHarness />, { wrapper: makeWrapper(queryClient) });
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('0'));
    await waitFor(() => expect(screen.getByTestId('pending-count')).toHaveTextContent('1'));
    const callsBefore = listMock.mock.calls.length;
    invalidateSpy.mockClear();

    await user.click(screen.getByRole('button', { name: 'activate' }));

    // The mounted user-directory query refetches after invalidation
    // (observable via the service mock, same convention as the doctor module).
    await waitFor(() =>
      expect(listMock.mock.calls.length).toBeGreaterThan(callsBefore),
    );
    // Both key spaces are invalidated — the user directory AND the admin
    // pending-approval list. The pending hook is fully mocked, so assert the
    // invalidation calls directly for that namespace.
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['users'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['auth', 'pending-users'] });
    expect(activateMock).toHaveBeenCalledWith(3);
  });

  it('propagates mutation errors to the mutation result', async () => {
    activateMock.mockRejectedValue(new Error('Last admin cannot be modified'));
    const queryClient = createQueryClient();

    const { result } = renderHook(() => useActivateUser(), { wrapper: makeWrapper(queryClient) });
    result.current.mutate(3);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });
});
