import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import {
  useApproveUser,
  useDeactivatePendingUser,
  usePendingUsers,
} from './usePendingUsers';
import { parseApiError } from '../../services/apiError';
import { authService } from '../../services/authService';
import type { PendingUserResponse } from '../../types/auth';

vi.mock('../../services/authService', () => ({
  authService: {
    login: vi.fn(),
    getMe: vi.fn(),
    register: vi.fn(),
    fetchPendingUsers: vi.fn(),
    approveUser: vi.fn(),
    deactivateUser: vi.fn(),
  },
}));

const fetchPendingMock = vi.mocked(authService.fetchPendingUsers);
const approveMock = vi.mocked(authService.approveUser);
const deactivateMock = vi.mocked(authService.deactivateUser);

const pendingUsers: PendingUserResponse[] = [
  { id: 2, full_name: 'Maria Santos', email: 'maria@example.com', status: 'pending' },
];

function forbiddenError(): AxiosError {
  const config = {} as InternalAxiosRequestConfig;
  const response = {
    data: { success: false, message: 'Insufficient permissions' },
    status: 403,
    statusText: 'Forbidden',
    headers: {},
    config,
  } as AxiosResponse;
  return new AxiosError(
    'Request failed with status code 403',
    'ERR_BAD_REQUEST',
    config,
    undefined,
    response,
  );
}

/** Harness that mounts the pending query alongside both mutations. */
function Harness() {
  const { data, isLoading, isError, error } = usePendingUsers();
  const approve = useApproveUser();
  const deactivate = useDeactivatePendingUser();

  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="error">{isError ? parseApiError(error).kind : 'none'}</span>
      <span data-testid="count">{data?.length ?? -1}</span>
      <button onClick={() => approve.mutate({ userId: 2, roleId: 6 })}>approve</button>
      <button onClick={() => deactivate.mutate(3)}>deactivate</button>
    </div>
  );
}

/**
 * Query client for hook tests: no retries (failures surface immediately), no
 * refetch-on-window-focus (userEvent dispatches focus events that would add
 * spurious refetches after invalidation), and infinite gc/stale so cached
 * data cannot leak between tests.
 */
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

describe('usePendingUsers', () => {
  beforeEach(() => {
    fetchPendingMock.mockReset();
    approveMock.mockReset();
    deactivateMock.mockReset();
  });

  it('retrieves the pending users list', async () => {
    fetchPendingMock.mockResolvedValue(pendingUsers);
    const queryClient = createQueryClient();

    render(<Harness />, { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'));
    expect(fetchPendingMock).toHaveBeenCalledTimes(1);
  });

  it('exposes loading while the list is being fetched', () => {
    fetchPendingMock.mockReturnValue(new Promise(() => {}));
    const queryClient = createQueryClient();

    render(<Harness />, { wrapper: makeWrapper(queryClient) });

    expect(screen.getByTestId('loading')).toHaveTextContent('true');
    expect(screen.getByTestId('count')).toHaveTextContent('-1');
  });

  it('surfaces a generic error as an error state', async () => {
    fetchPendingMock.mockRejectedValue(new Error('Server exploded'));
    const queryClient = createQueryClient();

    render(<Harness />, { wrapper: makeWrapper(queryClient) });

    // Non-Axios errors classify as `unknown`.
    await waitFor(
      () => expect(screen.getByTestId('error')).toHaveTextContent('unknown'),
      { timeout: 4000 },
    );
  });

  it('classifies a 403 as forbidden and does not retry', async () => {
    fetchPendingMock.mockRejectedValue(forbiddenError());
    const queryClient = createQueryClient();

    render(<Harness />, { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('forbidden'));
    // 403 is non-retryable → exactly one request.
    expect(fetchPendingMock).toHaveBeenCalledTimes(1);
  });
});

describe('useApproveUser', () => {
  it('approves a user and invalidates the pending list (refetch)', async () => {
    fetchPendingMock.mockResolvedValue(pendingUsers);
    approveMock.mockResolvedValue({ message: 'User approved' });
    const queryClient = createQueryClient();

    const user = userEvent.setup();
    render(<Harness />, { wrapper: makeWrapper(queryClient) });
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'));
    const callsBeforeMutation = fetchPendingMock.mock.calls.length;

    await user.click(screen.getByRole('button', { name: 'approve' }));

    // onSuccess invalidates the query key → the list is refetched.
    await waitFor(() =>
      expect(fetchPendingMock.mock.calls.length).toBeGreaterThan(callsBeforeMutation),
    );
    expect(approveMock).toHaveBeenCalledWith(2, 6);
  });

  it('propagates approval errors to the mutation', async () => {
    approveMock.mockRejectedValue(new Error('Approval failed'));
    const queryClient = createQueryClient();

    const { result } = renderHook(() => useApproveUser(), {
      wrapper: makeWrapper(queryClient),
    });

    result.current.mutate({ userId: 2, roleId: 6 });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });
});

describe('useDeactivatePendingUser', () => {
  it('deactivates a user and invalidates the pending list (refetch)', async () => {
    fetchPendingMock.mockResolvedValue(pendingUsers);
    deactivateMock.mockResolvedValue({ message: 'User deactivated' });
    const queryClient = createQueryClient();

    const user = userEvent.setup();
    render(<Harness />, { wrapper: makeWrapper(queryClient) });
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'));
    const callsBeforeMutation = fetchPendingMock.mock.calls.length;

    await user.click(screen.getByRole('button', { name: 'deactivate' }));

    // onSuccess invalidates the query key → the list is refetched.
    await waitFor(() =>
      expect(fetchPendingMock.mock.calls.length).toBeGreaterThan(callsBeforeMutation),
    );
    expect(deactivateMock).toHaveBeenCalledWith(3);
  });

  it('propagates deactivation errors to the mutation', async () => {
    deactivateMock.mockRejectedValue(new Error('Deactivation failed'));
    const queryClient = createQueryClient();

    const { result } = renderHook(() => useDeactivatePendingUser(), {
      wrapper: makeWrapper(queryClient),
    });

    result.current.mutate(3);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });
});
