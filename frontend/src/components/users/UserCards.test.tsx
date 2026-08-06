import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/testUtils';
import { UserProfileCard } from './UserProfileCard';
import { UserAccountCard } from './UserAccountCard';
import { UserStatusCard } from './UserStatusCard';
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

describe('UserProfileCard', () => {
  it('maps backend identity fields 1:1', () => {
    renderWithProviders(<UserProfileCard user={user} />);

    expect(screen.getByText('User Information')).toBeInTheDocument();
    expect(screen.getByText('Full Name')).toBeInTheDocument();
    expect(screen.getByText('Dr. Jose Rizal')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('jose@clinic.com')).toBeInTheDocument();
    expect(screen.getByText('Role')).toBeInTheDocument();
    expect(screen.getByText('GENERAL_DOCTOR')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders dashes for a user without a role', () => {
    renderWithProviders(<UserProfileCard user={{ ...user, role_id: null, role_name: null }} />);

    // Two dashes: role + status-list fallbacks resolve distinctly
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByText('GENERAL_DOCTOR')).not.toBeInTheDocument();
  });
});

describe('UserAccountCard', () => {
  it('maps backend account metadata 1:1', () => {
    renderWithProviders(<UserAccountCard user={user} />);

    expect(screen.getByText('Account Information')).toBeInTheDocument();
    expect(screen.getByText('User ID')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Created Date')).toBeInTheDocument();
    expect(screen.getByText('Updated Date')).toBeInTheDocument();
    expect(screen.getByText('Last Login')).toBeInTheDocument();
    expect(screen.getByText('Created By')).toBeInTheDocument();
    expect(screen.getByText('Updated By')).toBeInTheDocument();
  });

  it('renders dashes for null optional fields', () => {
    renderWithProviders(
      <UserAccountCard
        user={{
          ...user,
          last_login_at: null,
          created_at: null,
          updated_at: null,
          created_by: null,
          updated_by: null,
        }}
      />,
    );

    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(5);
  });
});

describe('UserStatusCard', () => {
  it('summarizes the current status and role from backend values', () => {
    renderWithProviders(<UserStatusCard user={user} />);

    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Current Status')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Current Role')).toBeInTheDocument();
    expect(screen.getByText('GENERAL_DOCTOR')).toBeInTheDocument();
  });

  it('renders a dash for the role when unassigned', () => {
    renderWithProviders(<UserStatusCard user={{ ...user, role_id: null, role_name: null }} />);

    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByText('GENERAL_DOCTOR')).not.toBeInTheDocument();
  });
});
