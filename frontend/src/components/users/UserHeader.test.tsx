import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/testUtils';
import { UserHeader } from './UserHeader';
import type { UserDetailResponse } from '../../types/user';

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

describe('UserHeader', () => {
  it('renders the identity, email, role and status badges', () => {
    renderWithProviders(<UserHeader user={user} />);

    expect(screen.getByRole('heading', { name: 'Dr. Jose Rizal' })).toBeInTheDocument();
    expect(screen.getByText('jose@clinic.com')).toBeInTheDocument();
    expect(screen.getByText('GENERAL_DOCTOR')).toBeInTheDocument();
    // Active status badge (backend `status` value)
    expect(screen.getByText('Active')).toBeInTheDocument();
    // Avatar initials derived from the full name ('Dr.' + 'Rizal')
    expect(screen.getByRole('img', { name: 'Dr. Jose Rizal' })).toBeInTheDocument();
    expect(screen.getByText('DR')).toBeInTheDocument();
  });

  it('renders the fallback when no role is assigned', () => {
    renderWithProviders(
      <UserHeader user={{ ...user, role_id: null, role_name: null }} />,
    );

    expect(screen.getByText('No role assigned')).toBeInTheDocument();
  });

  it('renders the user id fallback when the full name is empty', () => {
    renderWithProviders(<UserHeader user={{ ...user, full_name: '' }} />);

    expect(screen.getByRole('heading', { name: 'User #3' })).toBeInTheDocument();
  });

  it('renders the actions slot', () => {
    const actions = <button type="button">Change Role</button>;
    renderWithProviders(<UserHeader user={user} actions={actions} />);

    expect(screen.getByRole('button', { name: 'Change Role' })).toBeInTheDocument();
  });

  it('renders the pending status value as-is', () => {
    renderWithProviders(<UserHeader user={{ ...user, status: 'pending' }} />);

    expect(screen.getByText('Pending')).toBeInTheDocument();
  });
});
