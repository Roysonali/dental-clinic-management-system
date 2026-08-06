import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders } from '../../test/testUtils';
import { UserDetailsPage } from './UserDetailsPage';
import { userService } from '../../services/userService';
import type { UserDetailResponse } from '../../types/user';

vi.mock('../../services/userService', () => ({
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
  last_login_at: null,
  created_by: 1,
  created_at: '2026-06-01T08:00:00Z',
  updated_at: null,
  updated_by: null,
};

describe('UserDetailsPage', () => {
  const getMock = vi.mocked(userService.get);

  beforeEach(() => {
    getMock.mockReset();
  });

  it('renders the user details through the container', async () => {
    getMock.mockResolvedValue(user);
    renderWithProviders(
      <Routes>
        <Route path="/users/:userId" element={<UserDetailsPage />} />
      </Routes>,
      { route: '/users/3' },
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Dr. Jose Rizal' })).toBeInTheDocument();
    });
    expect(screen.getByText('User Information')).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith(3);
  });

  it('shows the error state when the user cannot be loaded', async () => {
    getMock.mockRejectedValue(new Error('User does not exist'));
    renderWithProviders(
      <Routes>
        <Route path="/users/:userId" element={<UserDetailsPage />} />
      </Routes>,
      { route: '/users/3' },
    );

    // shouldRetryQuery retries plain errors once (~1s backoff) before
    // settling into the error state, so wait explicitly.
    expect(
      await screen.findByText('Unable to load user', undefined, { timeout: 4000 }),
    ).toBeInTheDocument();
  });
});
