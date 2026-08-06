import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders } from '../../../test/testUtils';
import { UserDetailsContainer } from './UserDetailsContainer';
import { userService } from '../../../services/userService';
import type { UserDetailResponse } from '../../../types/user';

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

const user: UserDetailResponse = {
  id: 3,
  full_name: 'Dr. Jose Rizal',
  email: 'jose@clinic.com',
  status: 'active',
  is_active: true,
  role_id: 3,
  role_name: 'GENERAL_DOCTOR',
  last_login_at: '2026-07-01T09:00:00Z',
  created_by: 1,
  created_at: '2026-06-01T08:00:00Z',
  updated_at: '2026-06-15T08:00:00Z',
  updated_by: 1,
};

function renderDetails() {
  return renderWithProviders(
    <Routes>
      <Route path="/users/:userId" element={<UserDetailsContainer />} />
    </Routes>,
    { route: '/users/3' },
  );
}

describe('UserDetailsContainer', () => {
  const getMock = vi.mocked(userService.get);
  const changeRoleMock = vi.mocked(userService.changeRole);
  const activateMock = vi.mocked(userService.activate);
  const deactivateMock = vi.mocked(userService.deactivate);

  beforeEach(() => {
    navigateMock.mockReset();
    getMock.mockReset();
    changeRoleMock.mockReset();
    activateMock.mockReset();
    deactivateMock.mockReset();
  });

  it('renders the header and cards once loaded', async () => {
    getMock.mockResolvedValue(user);
    renderDetails();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Dr. Jose Rizal' })).toBeInTheDocument();
    });
    expect(screen.getByText('User Information')).toBeInTheDocument();
    expect(screen.getByText('Account Information')).toBeInTheDocument();
    // Status card headers (unique strings)
    expect(screen.getByText('Current Status')).toBeInTheDocument();
    expect(screen.getByText('Current Role')).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith(3);
  });

  it('shows a loading state while fetching', () => {
    getMock.mockReturnValue(new Promise(() => {}));
    renderDetails();
    expect(screen.getByRole('status', { name: 'Loading user' })).toBeInTheDocument();
  });

  it('shows the error state and retries', async () => {
    getMock.mockRejectedValue(new Error('User does not exist'));
    renderDetails();

    // shouldRetryQuery retries plain errors once (~1s backoff) before
    // settling into the error state, so wait explicitly.
    await waitFor(
      () => {
        expect(screen.getByText('Unable to load user')).toBeInTheDocument();
      },
      { timeout: 4000 },
    );

    getMock.mockResolvedValue(user);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Dr. Jose Rizal' })).toBeInTheDocument();
    });
    expect(getMock).toHaveBeenCalledTimes(3); // 1 initial + 1 retry + 1 manual refetch
  });

  it('shows the error state for an invalid user id in the URL', () => {
    renderWithProviders(
      <Routes>
        <Route path="/users/:userId" element={<UserDetailsContainer />} />
      </Routes>,
      { route: '/users/not-a-number' },
    );

    expect(screen.getByText('Unable to load user')).toBeInTheDocument();
    expect(getMock).not.toHaveBeenCalled();
  });

  it('navigates back to the users list', async () => {
    getMock.mockResolvedValue(user);
    renderDetails();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Dr. Jose Rizal' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Back to Users' }));
    expect(navigateMock).toHaveBeenCalledWith('/users');
  });

  it('deactivates through the status dialog and refetches (cache invalidation)', async () => {
    getMock.mockResolvedValue(user);
    deactivateMock.mockResolvedValue({ user_id: 3, message: 'User deactivated successfully' });
    renderDetails();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Dr. Jose Rizal' })).toBeInTheDocument();
    });
    expect(getMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    const dialog = screen.getByRole('dialog', { name: 'Deactivate user' });
    expect(dialog).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Deactivate' }));

    await waitFor(() => expect(deactivateMock).toHaveBeenCalledWith(3));
    // Success closes the dialog and invalidates ['users'] → detail refetches.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(getMock.mock.calls.length).toBeGreaterThanOrEqual(2));
  });

  it('activates an inactive user through the status dialog', async () => {
    getMock.mockResolvedValue({ ...user, is_active: false, status: 'inactive' });
    activateMock.mockResolvedValue({ user_id: 3, message: 'User activated successfully' });
    renderDetails();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Dr. Jose Rizal' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Activate' }));
    const dialog = screen.getByRole('dialog', { name: 'Activate user' });
    expect(dialog).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Activate' }));

    await waitFor(() => expect(activateMock).toHaveBeenCalledWith(3));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('changes the role through the role dialog and refetches', async () => {
    getMock.mockResolvedValue(user);
    changeRoleMock.mockResolvedValue({ user_id: 3, message: 'Role updated successfully' });
    renderDetails();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Dr. Jose Rizal' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Change Role' }));
    const roleDialog = screen.getByRole('dialog', { name: 'Change role' });
    expect(roleDialog).toBeInTheDocument();
    // The dialog prefills the current role (3) and shows it as the current role.
    expect(within(roleDialog).getByText('GENERAL_DOCTOR')).toBeInTheDocument();

    fireEvent.change(within(roleDialog).getByLabelText('New Role'), { target: { value: '5' } });
    fireEvent.click(within(roleDialog).getByRole('button', { name: 'Save Role' }));

    await waitFor(() => expect(changeRoleMock).toHaveBeenCalledWith(3, 5));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(getMock.mock.calls.length).toBeGreaterThanOrEqual(2));
  });

  it('skips the mutation when the selected role is unchanged', async () => {
    getMock.mockResolvedValue(user);
    renderDetails();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Dr. Jose Rizal' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Change Role' }));
    // Keep the prefilled current role (3) and save — no redundant write.
    fireEvent.click(screen.getByRole('button', { name: 'Save Role' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(changeRoleMock).not.toHaveBeenCalled();
  });

  it('keeps the status dialog open on a backend error', async () => {
    getMock.mockResolvedValue(user);
    deactivateMock.mockRejectedValue(
      Object.assign(new Error('Request failed'), {
        isAxiosError: true,
        response: { status: 400, data: { message: 'You cannot deactivate your own account.' } },
      }),
    );
    renderDetails();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Dr. Jose Rizal' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    const dialog = screen.getByRole('dialog', { name: 'Deactivate user' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Deactivate' }));

    await waitFor(() =>
      expect(screen.getByText('You cannot deactivate your own account.')).toBeInTheDocument(),
    );
    expect(screen.getByRole('dialog', { name: 'Deactivate user' })).toBeInTheDocument();
  });

  it('keeps the role dialog open on a backend error', async () => {
    getMock.mockResolvedValue(user);
    changeRoleMock.mockRejectedValue(
      Object.assign(new Error('Request failed'), {
        isAxiosError: true,
        response: { status: 403, data: { message: 'You cannot change your own role.' } },
      }),
    );
    renderDetails();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Dr. Jose Rizal' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Change Role' }));
    const roleDialog = screen.getByRole('dialog', { name: 'Change role' });
    fireEvent.change(within(roleDialog).getByLabelText('New Role'), { target: { value: '5' } });
    fireEvent.click(within(roleDialog).getByRole('button', { name: 'Save Role' }));

    await waitFor(() => expect(screen.getByText('You cannot change your own role.')).toBeInTheDocument());
    expect(screen.getByRole('dialog', { name: 'Change role' })).toBeInTheDocument();
  });

  it('restores focus to the trigger after closing a dialog', async () => {
    getMock.mockResolvedValue(user);
    renderDetails();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Dr. Jose Rizal' })).toBeInTheDocument();
    });

    const deactivateButton = screen.getByRole('button', { name: 'Deactivate' });
    deactivateButton.focus();
    fireEvent.click(deactivateButton);
    expect(screen.getByRole('dialog', { name: 'Deactivate user' })).toBeInTheDocument();

    // Closing via Cancel restores focus to the trigger (Modal focus trap).
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(document.activeElement).toBe(deactivateButton);
    });
  });
});
