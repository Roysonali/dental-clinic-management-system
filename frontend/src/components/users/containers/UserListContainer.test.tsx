import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { renderWithProviders } from '../../../test/testUtils';
import { UserListContainer } from './UserListContainer';
import { userService } from '../../../services/userService';
import { authService } from '../../../services/authService';
import type { UserListResponse, UserListItem } from '../../../types/user';
import type { PendingUserResponse } from '../../../types/auth';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('../../../services/userService', () => ({
  userService: {
    list: vi.fn(),
    get: vi.fn(),
    changeRole: vi.fn(),
    activate: vi.fn(),
    deactivate: vi.fn(),
  },
}));

// The Add-User drawer orchestrates the register → approve workflow.
vi.mock('../../../services/authService', () => ({
  authService: {
    register: vi.fn(),
    fetchPendingUsers: vi.fn(),
    approveUser: vi.fn(),
    deactivateUser: vi.fn(),
    login: vi.fn(),
    getMe: vi.fn(),
  },
}));

const listMock = vi.mocked(userService.list);
const changeRoleMock = vi.mocked(userService.changeRole);
const activateMock = vi.mocked(userService.activate);
const deactivateMock = vi.mocked(userService.deactivate);
const registerMock = vi.mocked(authService.register);
const fetchPendingMock = vi.mocked(authService.fetchPendingUsers);
const approveMock = vi.mocked(authService.approveUser);

const makeUser = (overrides: Partial<UserListItem> = {}): UserListItem => ({
  id: 3,
  full_name: 'Dr. Jose Rizal',
  email: 'jose@clinic.com',
  status: 'active',
  is_active: true,
  role_id: 3,
  role_name: 'GENERAL_DOCTOR',
  last_login_at: null,
  created_at: '2026-06-01T08:00:00Z',
  ...overrides,
});

const makeResponse = (total: number): UserListResponse => ({
  items: [
    makeUser(),
    makeUser({
      id: 4,
      full_name: 'Maria Santos',
      email: 'maria@clinic.com',
      status: 'inactive',
      is_active: false,
      role_id: null,
      role_name: null,
    }),
  ],
  total,
  page: 1,
  page_size: 10,
});

/** The neutral params object the container sends before any filter applies. */
const neutralParams = {
  page: 1,
  page_size: 10,
  search: undefined,
  status: undefined,
  role_id: undefined,
};

describe('UserListContainer', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    listMock.mockReset();
    listMock.mockResolvedValue(makeResponse(2));
    changeRoleMock.mockReset();
    activateMock.mockReset();
    deactivateMock.mockReset();
    registerMock.mockReset();
    fetchPendingMock.mockReset();
    approveMock.mockReset();
  });

  it('renders users fetched from the service', async () => {
    renderWithProviders(<UserListContainer />);

    await waitFor(() => {
      expect(screen.getByText('Dr. Jose Rizal')).toBeInTheDocument();
      expect(screen.getByText('Maria Santos')).toBeInTheDocument();
    });
    expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ page: 1, page_size: 10 }));
  });

  it('refetches with the debounced search term', async () => {
    renderWithProviders(<UserListContainer />);

    await waitFor(() => expect(screen.getByText('Dr. Jose Rizal')).toBeInTheDocument());
    expect(listMock).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByPlaceholderText('Search by name or email…'), {
      target: { value: 'jose' },
    });

    await waitFor(
      () => expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ search: 'jose' })),
      { timeout: 2000 },
    );
  });

  it('refetches when the status filter changes', async () => {
    renderWithProviders(<UserListContainer />);

    await waitFor(() => expect(screen.getByText('Dr. Jose Rizal')).toBeInTheDocument());
    expect(listMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Pending' }));

    await waitFor(() =>
      expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending' })),
    );
  });

  it('refetches when a role filter is selected', async () => {
    renderWithProviders(<UserListContainer />);

    await waitFor(() => expect(screen.getByText('Dr. Jose Rizal')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Filter by role'), { target: { value: '2' } });

    await waitFor(() =>
      expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ role_id: 2 })),
    );
  });

  it('paginates through results', async () => {
    listMock.mockResolvedValue(makeResponse(45)); // 45 total → 5 pages at page_size 10
    renderWithProviders(<UserListContainer />);

    await waitFor(() => expect(screen.getByText('Dr. Jose Rizal')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));

    await waitFor(() =>
      expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ page: 2 })),
    );
  });

  it('clears all filters and resets to page 1', async () => {
    renderWithProviders(<UserListContainer />);

    await waitFor(() => expect(screen.getByText('Dr. Jose Rizal')).toBeInTheDocument());

    // Activate a filter first (raw input enables Clear Filters immediately).
    fireEvent.change(screen.getByPlaceholderText('Search by name or email…'), {
      target: { value: 'jose' },
    });
    await waitFor(
      () => expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ search: 'jose' })),
      { timeout: 2000 },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clear Filters' }));

    expect(screen.getByPlaceholderText('Search by name or email…')).toHaveValue('');
    await waitFor(() => expect(listMock).toHaveBeenCalledWith(neutralParams));
  });

  it('refetches on Refresh', async () => {
    renderWithProviders(<UserListContainer />);

    await waitFor(() => expect(screen.getByText('Dr. Jose Rizal')).toBeInTheDocument());
    const callsBefore = listMock.mock.calls.length;

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    await waitFor(() =>
      expect(listMock.mock.calls.length).toBeGreaterThan(callsBefore),
    );
  });

  it('navigates to the user details route on view details', async () => {
    renderWithProviders(<UserListContainer />);

    await waitFor(() => expect(screen.getByText('Dr. Jose Rizal')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'View details for Dr. Jose Rizal' }));

    expect(navigateMock).toHaveBeenCalledWith('/users/3');
  });

  it('deactivates a user through the confirmation dialog and refetches', async () => {
    deactivateMock.mockResolvedValue({ user_id: 3, message: 'User deactivated successfully' });
    renderWithProviders(<UserListContainer />);

    await waitFor(() => expect(screen.getByText('Dr. Jose Rizal')).toBeInTheDocument());
    const callsBefore = listMock.mock.calls.length;

    fireEvent.click(screen.getByRole('button', { name: 'Deactivate Dr. Jose Rizal' }));
    expect(screen.getByRole('dialog', { name: 'Deactivate user' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));

    await waitFor(() => expect(deactivateMock).toHaveBeenCalledWith(3));
    // Success closes the dialog and invalidates the ['users'] cache (refetch).
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() =>
      expect(listMock.mock.calls.length).toBeGreaterThan(callsBefore),
    );
  });

  it('activates an inactive user through the confirmation dialog', async () => {
    activateMock.mockResolvedValue({ user_id: 4, message: 'User activated successfully' });
    renderWithProviders(<UserListContainer />);

    await waitFor(() => expect(screen.getByText('Dr. Jose Rizal')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Activate Maria Santos' }));
    expect(screen.getByRole('dialog', { name: 'Activate user' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Activate' }));

    await waitFor(() => expect(activateMock).toHaveBeenCalledWith(4));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('changes a user role through the role dialog and refetches', async () => {
    changeRoleMock.mockResolvedValue({ user_id: 3, message: 'Role updated successfully' });
    renderWithProviders(<UserListContainer />);

    await waitFor(() => expect(screen.getByText('Dr. Jose Rizal')).toBeInTheDocument());
    const callsBefore = listMock.mock.calls.length;

    fireEvent.click(screen.getByRole('button', { name: 'Change role for Dr. Jose Rizal' }));
    expect(screen.getByRole('dialog', { name: 'Change role' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('New Role'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Role' }));

    await waitFor(() => expect(changeRoleMock).toHaveBeenCalledWith(3, 5));
    // Success closes the dialog and invalidates the ['users'] cache (refetch).
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() =>
      expect(listMock.mock.calls.length).toBeGreaterThan(callsBefore),
    );
  });

  it('skips the mutation when the selected role is unchanged (PATCH semantics)', async () => {
    renderWithProviders(<UserListContainer />);

    await waitFor(() => expect(screen.getByText('Dr. Jose Rizal')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Change role for Dr. Jose Rizal' }));
    // Keep the prefilled current role (3) and save — no redundant write.
    fireEvent.click(screen.getByRole('button', { name: 'Save Role' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(changeRoleMock).not.toHaveBeenCalled();
  });

  it('surfaces status-mutation errors in the dialog and keeps it open', async () => {
    deactivateMock.mockRejectedValue(new Error('Cannot modify the last remaining admin account'));
    renderWithProviders(<UserListContainer />);

    await waitFor(() => expect(screen.getByText('Dr. Jose Rizal')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate Dr. Jose Rizal' }));
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));

    await waitFor(() =>
      expect(
        screen.getByText('Cannot modify the last remaining admin account'),
      ).toBeInTheDocument(),
    );
    // The dialog stays open on errors — it closes only on success.
    expect(screen.getByRole('dialog', { name: 'Deactivate user' })).toBeInTheDocument();
  });

  it('surfaces role-mutation errors in the dialog and keeps it open', async () => {
    changeRoleMock.mockRejectedValue(new Error('You cannot change your own role'));
    renderWithProviders(<UserListContainer />);

    await waitFor(() => expect(screen.getByText('Dr. Jose Rizal')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Change role for Dr. Jose Rizal' }));
    fireEvent.change(screen.getByLabelText('New Role'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Role' }));

    await waitFor(() => expect(screen.getByText('You cannot change your own role')).toBeInTheDocument());
    expect(screen.getByRole('dialog', { name: 'Change role' })).toBeInTheDocument();
  });

  it('renders the error state when the list query fails', async () => {
    listMock.mockRejectedValue({
      isAxiosError: true,
      response: { status: 403, data: { message: 'Failed to load data' } },
    });
    renderWithProviders(<UserListContainer />);

    expect(await screen.findAllByText('Failed to load data')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('renders the empty state when there are no users', async () => {
    listMock.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 10 });
    renderWithProviders(<UserListContainer />);

    expect(await screen.findByText('No users found')).toBeInTheDocument();
  });

  it('opens the Add User drawer from the toolbar', async () => {
    renderWithProviders(<UserListContainer />);

    await waitFor(() => expect(screen.getByText('Dr. Jose Rizal')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Add User' }));

    expect(screen.getByRole('dialog', { name: 'Add User' })).toBeInTheDocument();
  });

  it('adds a user through the register → approve workflow and shows a success toast', async () => {
    registerMock.mockResolvedValue({
      message: 'Registration submitted. Waiting for admin approval.',
    });
    const pendingUser: PendingUserResponse = {
      id: 9,
      full_name: 'Jane Doe',
      email: 'jane@example.com',
      status: 'pending',
    };
    fetchPendingMock.mockResolvedValue([pendingUser]);
    approveMock.mockResolvedValue({ message: 'User approved successfully.' });

    renderWithProviders(<UserListContainer />);

    await waitFor(() => expect(screen.getByText('Dr. Jose Rizal')).toBeInTheDocument());
    // Capture the count BEFORE the workflow — the invalidation-triggered
    // refetch is fast, so a post-approve capture would already include it.
    const listCallsBeforeSubmit = listMock.mock.calls.length;

    fireEvent.click(screen.getByRole('button', { name: 'Add User' }));

    const dialog = screen.getByRole('dialog', { name: 'Add User' });
    fireEvent.change(within(dialog).getByLabelText(/full name/i), {
      target: { value: 'Jane Doe' },
    });
    fireEvent.change(within(dialog).getByLabelText(/email address/i), {
      target: { value: 'jane@example.com' },
    });
    fireEvent.change(within(dialog).getByPlaceholderText('Create a strong password'), {
      target: { value: 'Secure@Pass1' },
    });
    fireEvent.change(within(dialog).getByLabelText(/role/i), { target: { value: '3' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add User' }));

    await waitFor(() => expect(registerMock).toHaveBeenCalled());
    await waitFor(() => expect(approveMock).toHaveBeenCalledWith(9, 3));

    // Approve invalidates the user directory — the list refetches.
    await waitFor(() =>
      expect(listMock.mock.calls.length).toBeGreaterThan(listCallsBeforeSubmit),
    );

    // Success closes the drawer and reports a success toast.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText('User added')).toBeInTheDocument();
  });

  it('keeps the drawer open and shows the backend message on duplicate email', async () => {
    registerMock.mockRejectedValue({
      isAxiosError: true,
      response: { status: 409, data: { message: 'Email already registered' } },
    });

    renderWithProviders(<UserListContainer />);

    await waitFor(() => expect(screen.getByText('Dr. Jose Rizal')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Add User' }));

    const dialog = screen.getByRole('dialog', { name: 'Add User' });
    fireEvent.change(within(dialog).getByLabelText(/full name/i), {
      target: { value: 'Jane Doe' },
    });
    fireEvent.change(within(dialog).getByLabelText(/email address/i), {
      target: { value: 'jane@example.com' },
    });
    fireEvent.change(within(dialog).getByPlaceholderText('Create a strong password'), {
      target: { value: 'Secure@Pass1' },
    });
    fireEvent.change(within(dialog).getByLabelText(/role/i), { target: { value: '3' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add User' }));

    expect(await screen.findByText('Email already registered')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Add User' })).toBeInTheDocument();
    expect(approveMock).not.toHaveBeenCalled();
  });

  it('shows a warning toast when automatic approval fails after registration', async () => {
    registerMock.mockResolvedValue({
      message: 'Registration submitted. Waiting for admin approval.',
    });
    fetchPendingMock.mockResolvedValue([
      { id: 9, full_name: 'Jane Doe', email: 'jane@example.com', status: 'pending' },
    ]);
    approveMock.mockRejectedValue({
      isAxiosError: true,
      response: { status: 400, data: { message: 'User is already active' } },
    });

    renderWithProviders(<UserListContainer />);

    await waitFor(() => expect(screen.getByText('Dr. Jose Rizal')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Add User' }));

    const dialog = screen.getByRole('dialog', { name: 'Add User' });
    fireEvent.change(within(dialog).getByLabelText(/full name/i), {
      target: { value: 'Jane Doe' },
    });
    fireEvent.change(within(dialog).getByLabelText(/email address/i), {
      target: { value: 'jane@example.com' },
    });
    fireEvent.change(within(dialog).getByPlaceholderText('Create a strong password'), {
      target: { value: 'Secure@Pass1' },
    });
    fireEvent.change(within(dialog).getByLabelText(/role/i), { target: { value: '3' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add User' }));

    // The account was registered; only automatic approval failed — the
    // drawer closes and a warning toast explains the user is pending.
    expect(
      await screen.findByText('User registered — approval pending'),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
