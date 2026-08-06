import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../test/testUtils';
import { UserTable } from './UserTable';
import type { UserListItem } from '../../types/user';

const makeUser = (overrides: Partial<UserListItem> = {}): UserListItem => ({
  id: 3,
  full_name: 'Dr. Jose Rizal',
  email: 'jose@clinic.com',
  status: 'active',
  is_active: true,
  role_id: 3,
  role_name: 'GENERAL_DOCTOR',
  last_login_at: '2026-07-01T08:00:00Z',
  created_at: '2026-06-01T08:00:00Z',
  ...overrides,
});

const users: UserListItem[] = [
  makeUser(),
  makeUser({
    id: 4,
    full_name: 'Maria Santos',
    email: 'maria@clinic.com',
    status: 'inactive',
    is_active: false,
    role_id: null,
    role_name: null,
    last_login_at: null,
  }),
];

const defaultProps = {
  users,
  status: 'all' as const,
  onStatusChange: vi.fn(),
  roleId: null,
  onRoleChange: vi.fn(),
  hasActiveFilters: false,
  onClearFilters: vi.fn(),
  onRefresh: vi.fn(),
};

describe('UserTable', () => {
  it('renders user rows with backend-mapped columns', () => {
    renderWithProviders(<UserTable {...defaultProps} />);

    expect(screen.getByText('Dr. Jose Rizal')).toBeInTheDocument();
    expect(screen.getByText('Maria Santos')).toBeInTheDocument();
    expect(screen.getByText('jose@clinic.com')).toBeInTheDocument();
    expect(screen.getByText('maria@clinic.com')).toBeInTheDocument();
    // Role badge (backend role_name value as-is)
    expect(screen.getByText('GENERAL_DOCTOR')).toBeInTheDocument();
    // Role-less user renders the dash
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    // Status badges (also present as filter toggles)
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Inactive').length).toBeGreaterThan(0);
    // Formatted backend dates (locale-independent match; both rows share the
    // same created_at, hence the getAllByText for the created date).
    expect(screen.getByText(/Jul/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Jun/i).length).toBeGreaterThan(0);
  });

  it('is accessible via the table aria-label', () => {
    renderWithProviders(<UserTable {...defaultProps} ariaLabel="Users table" />);
    expect(screen.getByRole('table', { name: 'Users table' })).toBeInTheDocument();
  });

  it('renders the empty state when there are no users', () => {
    renderWithProviders(<UserTable {...defaultProps} users={[]} />);
    expect(screen.getByText('No users found')).toBeInTheDocument();
  });

  it('renders skeleton rows while loading', () => {
    renderWithProviders(<UserTable {...defaultProps} loading />);
    const tbody = screen.getByRole('table', { name: 'Users table' }).querySelector('tbody');
    expect(tbody).toHaveAttribute('aria-busy', 'true');
  });

  it('renders the error state and calls onRetry', () => {
    const onRetry = vi.fn();
    renderWithProviders(<UserTable {...defaultProps} error="Failed to load data" onRetry={onRetry} />);

    expect(screen.getAllByText('Failed to load data').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('invokes view-details and change-role row actions', () => {
    const onViewDetails = vi.fn();
    const onChangeRole = vi.fn();
    renderWithProviders(
      <UserTable {...defaultProps} onViewDetails={onViewDetails} onChangeRole={onChangeRole} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'View details for Dr. Jose Rizal' }));
    expect(onViewDetails).toHaveBeenCalledWith(users[0]);

    fireEvent.click(screen.getByRole('button', { name: 'Change role for Dr. Jose Rizal' }));
    expect(onChangeRole).toHaveBeenCalledWith(users[0]);
  });

  it('shows deactivate only for active users and activate only for inactive users', () => {
    const onDeactivate = vi.fn();
    const onActivate = vi.fn();
    renderWithProviders(
      <UserTable {...defaultProps} onDeactivate={onDeactivate} onActivate={onActivate} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Deactivate Dr. Jose Rizal' }));
    expect(onDeactivate).toHaveBeenCalledWith(users[0]);
    expect(
      screen.queryByRole('button', { name: 'Deactivate Maria Santos' }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Activate Maria Santos' }));
    expect(onActivate).toHaveBeenCalledWith(users[1]);
    expect(
      screen.queryByRole('button', { name: 'Activate Dr. Jose Rizal' }),
    ).not.toBeInTheDocument();
  });

  it('renders the toolbar search with the backend-accurate placeholder', () => {
    renderWithProviders(
      <UserTable {...defaultProps} searchValue="" onSearchChange={vi.fn()} />,
    );
    expect(
      screen.getByRole('searchbox', { name: 'Search by name or email…' }),
    ).toBeInTheDocument();
  });
});
