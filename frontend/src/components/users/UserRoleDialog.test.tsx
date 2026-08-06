import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../test/testUtils';
import { UserRoleDialog } from './UserRoleDialog';
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

const rolelessUser: UserListItem = {
  ...user,
  role_id: null,
  role_name: null,
};

const baseProps = {
  open: true,
  user,
  onConfirm: vi.fn(),
  onClose: vi.fn(),
};

describe('UserRoleDialog', () => {
  it('does not render when closed', () => {
    renderWithProviders(<UserRoleDialog {...baseProps} open={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the user identity and current role', () => {
    renderWithProviders(<UserRoleDialog {...baseProps} />);

    expect(screen.getByRole('dialog', { name: 'Change role' })).toBeInTheDocument();
    expect(screen.getByText('Change Role')).toBeInTheDocument();
    expect(screen.getByText('jose@clinic.com')).toBeInTheDocument();
    expect(screen.getByText('Current role')).toBeInTheDocument();
    expect(screen.getByText('GENERAL_DOCTOR')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Role' })).toBeInTheDocument();
  });

  it('shows a no-role placeholder for role-less users and an empty selector', () => {
    renderWithProviders(<UserRoleDialog {...baseProps} user={rolelessUser} />);

    expect(screen.getByText('No role assigned')).toBeInTheDocument();
    expect(screen.getByLabelText('New Role')).toHaveValue('');
  });

  it('prefills the selector with the current role id and lists every role option', () => {
    renderWithProviders(<UserRoleDialog {...baseProps} />);

    expect(screen.getByLabelText('New Role')).toHaveValue('3');
    expect(screen.getByRole('option', { name: 'Administrator' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Receptionist' })).toBeInTheDocument();
  });

  it('calls onConfirm with the parsed role id for a valid selection', () => {
    const onConfirm = vi.fn();
    renderWithProviders(<UserRoleDialog {...baseProps} onConfirm={onConfirm} />);

    fireEvent.change(screen.getByLabelText('New Role'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Role' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(5);
  });

  it('blocks submission on an empty selection with a validation error', () => {
    const onConfirm = vi.fn();
    renderWithProviders(<UserRoleDialog {...baseProps} onConfirm={onConfirm} />);

    fireEvent.change(screen.getByLabelText('New Role'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Role' }));

    expect(screen.getByText('Role is required')).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('shows backend errors surfaced by the container', () => {
    renderWithProviders(
      <UserRoleDialog {...baseProps} error="You cannot change your own role" />,
    );

    expect(screen.getByText('You cannot change your own role')).toBeInTheDocument();
  });

  it('disables buttons while submitting', () => {
    renderWithProviders(<UserRoleDialog {...baseProps} submitting />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByLabelText('New Role')).toBeDisabled();
  });

  it('calls onClose when cancel is clicked', () => {
    const onClose = vi.fn();
    renderWithProviders(<UserRoleDialog {...baseProps} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape (keyboard support)', () => {
    const onClose = vi.fn();
    renderWithProviders(<UserRoleDialog {...baseProps} onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('restores focus to the trigger after closing', () => {
    renderWithProviders(<FocusHarness />);

    const trigger = screen.getByRole('button', { name: 'trigger' });
    trigger.focus();
    expect(trigger).toHaveFocus();

    // Opening the dialog captures the trigger as the previously-focused element.
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Change role' })).toBeInTheDocument();

    // Close via Escape — the shared Modal restores focus to the trigger.
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});

/** Local harness — the trigger button stays mounted across opens/closes so
 * the shared Modal can restore focus to it. */
function FocusHarness() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        trigger
      </button>
      <UserRoleDialog
        open={open}
        user={user}
        onConfirm={() => setOpen(false)}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
