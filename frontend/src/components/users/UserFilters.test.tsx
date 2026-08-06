import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../test/testUtils';
import { UserFilters } from './UserFilters';
import { USER_ROLE_OPTIONS } from '../../constants/user';

const baseProps = {
  status: 'all' as const,
  onStatusChange: vi.fn(),
  roleOptions: [
    { value: '', label: 'All roles' },
    ...USER_ROLE_OPTIONS.map((role) => ({ value: role.value, label: role.label })),
  ],
  roleId: null,
  onRoleChange: vi.fn(),
};

describe('UserFilters', () => {
  it('renders the status segmented control with every backend status', () => {
    renderWithProviders(<UserFilters {...baseProps} />);

    expect(screen.getByRole('group', { name: 'Filter by status' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pending' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Active' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Inactive' })).toBeInTheDocument();
  });

  it('fires onStatusChange with the selected status', () => {
    const onStatusChange = vi.fn();
    renderWithProviders(<UserFilters {...baseProps} onStatusChange={onStatusChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Pending' }));
    expect(onStatusChange).toHaveBeenCalledWith('pending');
  });

  it('fires onRoleChange with the parsed role id (null when cleared)', () => {
    const onRoleChange = vi.fn();
    renderWithProviders(<UserFilters {...baseProps} onRoleChange={onRoleChange} />);

    fireEvent.change(screen.getByLabelText('Filter by role'), { target: { value: '6' } });
    expect(onRoleChange).toHaveBeenCalledWith(6);

    fireEvent.change(screen.getByLabelText('Filter by role'), { target: { value: '' } });
    expect(onRoleChange).toHaveBeenCalledWith(null);
  });

  it('reflects the current roleId in the select value', () => {
    renderWithProviders(<UserFilters {...baseProps} roleId={2} />);
    expect(screen.getByLabelText('Filter by role')).toHaveValue('2');
  });

  it('disables controls when disabled', () => {
    renderWithProviders(<UserFilters {...baseProps} disabled />);
    expect(screen.getByRole('button', { name: 'Pending' })).toBeDisabled();
    expect(screen.getByLabelText('Filter by role')).toBeDisabled();
  });
});
