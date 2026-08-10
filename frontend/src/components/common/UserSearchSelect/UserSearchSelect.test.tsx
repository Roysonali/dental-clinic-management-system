import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../../test/testUtils';
import { UserSearchSelect } from './UserSearchSelect';
import { userService } from '../../../services/userService';
import type { UserListResponse } from '../../../types/user';

vi.mock('../../../services/userService', () => ({
  userService: {
    list: vi.fn(),
  },
}));

const listMock = vi.mocked(userService.list);

const response: UserListResponse = {
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
    {
      id: 4,
      full_name: 'Maria Santos',
      email: 'maria@clinic.com',
      status: 'active',
      is_active: true,
      role_id: 6,
      role_name: 'RECEPTIONIST',
      last_login_at: null,
      created_at: null,
    },
  ],
  total: 2,
  page: 1,
  page_size: 10,
};

describe('UserSearchSelect', () => {
  beforeEach(() => {
    listMock.mockReset();
    listMock.mockResolvedValue(response);
  });

  it('fetches the default user page when focused', async () => {
    renderWithProviders(<UserSearchSelect value="" onChange={vi.fn()} />);

    fireEvent.focus(screen.getByRole('combobox'));

    await waitFor(() => expect(listMock).toHaveBeenCalled());
    expect(listMock).toHaveBeenCalledWith({ search: undefined, page: 1, page_size: 10 });
  });

  it('re-searches with the debounced term as the user types', async () => {
    renderWithProviders(<UserSearchSelect value="" onChange={vi.fn()} />);

    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'jose' } });

    // Debounce is 350ms (useUsersSearch) — wait for the search call.
    await waitFor(
      () => expect(listMock).toHaveBeenCalledWith({ search: 'jose', page: 1, page_size: 10 }),
      { timeout: 2000 },
    );
  });

  it('selects a user and calls onChange with its id string', async () => {
    const onChange = vi.fn();
    renderWithProviders(<UserSearchSelect value="" onChange={onChange} />);

    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'jose' } });

    // Generous timeout: the search is debounced (350ms) and this file runs
    // under parallel full-suite load (established DensCare pattern).
    const option = await screen.findByRole('option', { name: /Dr\. Jose Rizal/i }, { timeout: 5000 });
    fireEvent.click(option);

    expect(onChange).toHaveBeenCalledWith('3');
  });

  it('shows an empty state when no users match', async () => {
    listMock.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 10 });
    renderWithProviders(<UserSearchSelect value="" onChange={vi.fn()} />);

    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'zzz' } });

    expect(await screen.findByText('No users found.')).toBeInTheDocument();
  });

  it('shows an error state with retry when the search fails', async () => {
    // Axios-like 403 error — shouldRetryQuery returns false for 403, so the
    // query fails immediately (no retry delay in tests).
    listMock.mockRejectedValue({
      isAxiosError: true,
      response: { status: 403, data: { message: 'Forbidden' } },
    });
    renderWithProviders(<UserSearchSelect value="" onChange={vi.fn()} />);

    fireEvent.focus(screen.getByRole('combobox'));

    expect(await screen.findByText(/Unable to load users/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('renders the selected user chip with a clear button when a value is set', () => {
    renderWithProviders(
      <UserSearchSelect value="3" selectedLabel="Dr. Jose Rizal" onChange={vi.fn()} />,
    );

    expect(screen.getByText('Dr. Jose Rizal')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear selected user' })).toBeInTheDocument();
  });

  it('does not fetch or open while disabled', () => {
    renderWithProviders(<UserSearchSelect value="" onChange={vi.fn()} disabled />);

    const input = screen.getByRole('combobox');
    fireEvent.focus(input);

    expect(listMock).not.toHaveBeenCalled();
  });
});
