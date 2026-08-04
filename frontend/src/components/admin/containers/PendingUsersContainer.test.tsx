import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, type InternalAxiosRequestConfig, type AxiosResponse } from 'axios';
import { PendingUsersContainer } from './PendingUsersContainer';
import type { PendingUserResponse } from '../../../types/auth';

const pendingUsers: PendingUserResponse[] = [
  { id: 2, full_name: 'Maria Santos', email: 'maria@example.com', status: 'pending' },
  { id: 3, full_name: 'Ana Reyes', email: 'ana@example.com', status: 'pending' },
];

const queryMock: {
  data: PendingUserResponse[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: ReturnType<typeof vi.fn>;
} = { data: pendingUsers, isLoading: false, isError: false, error: null, refetch: vi.fn() };
const approveMutationMock = { mutate: vi.fn(), isError: false, error: null, isPending: false, variables: null };
const deactivateMutationMock = { mutate: vi.fn(), isError: false, error: null, isPending: false, variables: null };

vi.mock('../../../hooks/auth/usePendingUsers', () => ({
  usePendingUsers: () => queryMock,
  useApproveUser: () => approveMutationMock,
  useDeactivatePendingUser: () => deactivateMutationMock,
}));

function forbiddenError(): AxiosError {
  const config = {} as InternalAxiosRequestConfig;
  const response = {
    data: { success: false, message: 'Insufficient permissions' },
    status: 403,
    statusText: 'Forbidden',
    headers: {},
    config,
  } as AxiosResponse;
  return new AxiosError('Request failed with status code 403', 'ERR_BAD_REQUEST', config, undefined, response);
}

describe('PendingUsersContainer', () => {
  beforeEach(() => {
    queryMock.data = pendingUsers;
    queryMock.isLoading = false;
    queryMock.isError = false;
    queryMock.error = null;
    approveMutationMock.mutate.mockReset();
    deactivateMutationMock.mutate.mockReset();
    approveMutationMock.isError = false;
    deactivateMutationMock.isError = false;
  });

  it('renders the pending users with name, email and status', () => {
    render(<PendingUsersContainer />);

    expect(screen.getByText('Maria Santos')).toBeInTheDocument();
    expect(screen.getByText('maria@example.com')).toBeInTheDocument();
    expect(screen.getByText('Ana Reyes')).toBeInTheDocument();
    expect(screen.getAllByText('Pending')).toHaveLength(2);
  });

  it('shows a loading spinner while fetching', () => {
    queryMock.isLoading = true;
    queryMock.data = undefined;

    render(<PendingUsersContainer />);

    expect(
      screen.getByRole('status', { name: 'Loading pending approvals' }),
    ).toBeInTheDocument();
  });

  it('renders an insufficient-permissions state on a 403 (non-admin)', () => {
    queryMock.isError = true;
    queryMock.error = forbiddenError();

    render(<PendingUsersContainer />);

    expect(screen.getByText('Insufficient permissions')).toBeInTheDocument();
    expect(
      screen.getByText(/restricted to Administrators and Chief Doctors/i),
    ).toBeInTheDocument();
  });

  it('approves a user with the selected role', async () => {
    const user = userEvent.setup();
    render(<PendingUsersContainer />);

    // Maria is the first row.
    const roleSelects = screen.getAllByRole('combobox');
    await user.selectOptions(roleSelects[0], '6'); // RECEPTIONIST

    const approveButtons = screen.getAllByRole('button', { name: 'Approve' });
    await user.click(approveButtons[0]);

    expect(approveMutationMock.mutate).toHaveBeenCalledWith({
      userId: 2,
      roleId: 6,
    });
  });

  it('keeps the approve button disabled until a role is selected', () => {
    render(<PendingUsersContainer />);

    const approveButtons = screen.getAllByRole('button', { name: 'Approve' });
    expect(approveButtons[0]).toBeDisabled();
  });

  it('deactivates a user after confirmation', async () => {
    const user = userEvent.setup();
    render(<PendingUsersContainer />);

    const deactivateButtons = screen.getAllByRole('button', { name: 'Deactivate' });
    await user.click(deactivateButtons[0]);

    expect(
      screen.getByRole('dialog', { name: 'Confirm deactivation' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Deactivate user' }));

    await waitFor(() =>
      expect(deactivateMutationMock.mutate.mock.calls[0]?.[0]).toBe(2),
    );
  });

  it('renders an empty state when there are no pending users', () => {
    queryMock.data = [];

    render(<PendingUsersContainer />);

    expect(screen.getByText('No pending approvals')).toBeInTheDocument();
  });
});
