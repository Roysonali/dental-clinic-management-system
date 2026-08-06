import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/testUtils';
import { UserListPage } from './UserListPage';
import { userService } from '../../services/userService';

vi.mock('../../services/userService', () => ({
  userService: {
    list: vi.fn(),
    get: vi.fn(),
    changeRole: vi.fn(),
    activate: vi.fn(),
    deactivate: vi.fn(),
  },
}));

describe('UserListPage', () => {
  beforeEach(() => {
    vi.mocked(userService.list).mockReset();
    vi.mocked(userService.list).mockResolvedValue({
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
          created_at: '2026-06-01T08:00:00Z',
        },
      ],
      total: 1,
      page: 1,
      page_size: 10,
    });
  });

  it('renders the page header and composes the user list container', async () => {
    renderWithProviders(<UserListPage />);

    expect(screen.getByRole('heading', { name: 'Users' })).toBeInTheDocument();
    expect(screen.getByText('Search, filter and manage user accounts.')).toBeInTheDocument();

    // The composed container fetches and renders the list.
    await waitFor(() => expect(screen.getByText('Dr. Jose Rizal')).toBeInTheDocument());
  });
});
