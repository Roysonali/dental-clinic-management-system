import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../test/testUtils';
import { UserStatusDialog } from './UserStatusDialog';
import type { UserListItem } from '../../types/user';

const user: UserListItem = {
  id: 3,
  full_name: 'Dr. Jose Rizal',
  email: 'jose@clinic.com',
  status: 'active',
  is_active: true,
  role_id: 3,
  role_name: 'GENERAL_DOCTOR',
  last_login_at: null,
  created_at: '2026-06-01T08:00:00Z',
};

const baseProps = {
  open: true,
  user,
  intent: 'deactivate' as const,
  onConfirm: vi.fn(),
  onClose: vi.fn(),
};

describe('UserStatusDialog', () => {
  it('does not render when closed', () => {
    renderWithProviders(<UserStatusDialog {...baseProps} open={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the deactivate confirmation', () => {
    renderWithProviders(<UserStatusDialog {...baseProps} />);
    expect(screen.getByRole('dialog', { name: 'Deactivate user' })).toBeInTheDocument();
    expect(screen.getByText('Deactivate User')).toBeInTheDocument();
    expect(screen.getByText('jose@clinic.com')).toBeInTheDocument();
    expect(screen.getByText('Dr. Jose Rizal')).toBeInTheDocument();
    expect(screen.getByText('deactivated')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deactivate' })).toBeInTheDocument();
  });

  it('renders the activate confirmation', () => {
    renderWithProviders(<UserStatusDialog {...baseProps} intent="activate" />);
    expect(screen.getByRole('dialog', { name: 'Activate user' })).toBeInTheDocument();
    expect(screen.getByText('Activate User')).toBeInTheDocument();
    expect(screen.getByText('activated')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Activate' })).toBeInTheDocument();
  });

  it('calls onConfirm when the confirm button is clicked', () => {
    const onConfirm = vi.fn();
    renderWithProviders(<UserStatusDialog {...baseProps} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when cancel is clicked', () => {
    const onClose = vi.fn();
    renderWithProviders(<UserStatusDialog {...baseProps} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows backend errors surfaced by the container', () => {
    renderWithProviders(
      <UserStatusDialog {...baseProps} error="Cannot deactivate the last remaining admin" />,
    );
    expect(
      screen.getByText('Cannot deactivate the last remaining admin'),
    ).toBeInTheDocument();
  });

  it('disables buttons while submitting', () => {
    renderWithProviders(<UserStatusDialog {...baseProps} submitting />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });

  it('closes on Escape (keyboard support)', () => {
    const onClose = vi.fn();
    renderWithProviders(<UserStatusDialog {...baseProps} onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
