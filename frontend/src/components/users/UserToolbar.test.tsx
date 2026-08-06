import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../test/testUtils';
import { UserToolbar } from './UserToolbar';

const baseProps = {
  status: 'all' as const,
  onStatusChange: vi.fn(),
  roleId: null,
  onRoleChange: vi.fn(),
  hasActiveFilters: false,
  onClearFilters: vi.fn(),
  onRefresh: vi.fn(),
};

describe('UserToolbar', () => {
  it('renders search with the backend-accurate placeholder (name or email only)', () => {
    renderWithProviders(
      <UserToolbar {...baseProps} searchValue="" onSearchChange={vi.fn()} />,
    );

    expect(
      screen.getByRole('searchbox', { name: 'Search by name or email…' }),
    ).toBeInTheDocument();
  });

  it('renders the status filter group and role filter select', () => {
    renderWithProviders(<UserToolbar {...baseProps} />);

    expect(screen.getByRole('group', { name: 'Filter by status' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pending' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Active' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Inactive' })).toBeInTheDocument();
    expect(screen.getByLabelText('Filter by role')).toBeInTheDocument();
  });

  it('renders role options derived from the seeded role constants', () => {
    renderWithProviders(<UserToolbar {...baseProps} />);

    expect(screen.getByRole('option', { name: 'All roles' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Administrator' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Receptionist' })).toBeInTheDocument();
  });

  it('fires filter callbacks with mapped values', () => {
    const onStatusChange = vi.fn();
    const onRoleChange = vi.fn();
    renderWithProviders(
      <UserToolbar {...baseProps} onStatusChange={onStatusChange} onRoleChange={onRoleChange} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Inactive' }));
    expect(onStatusChange).toHaveBeenCalledWith('inactive');

    fireEvent.change(screen.getByLabelText('Filter by role'), { target: { value: '2' } });
    expect(onRoleChange).toHaveBeenCalledWith(2);

    // Switching back to the all-option clears the filter.
    fireEvent.change(screen.getByLabelText('Filter by role'), { target: { value: '' } });
    expect(onRoleChange).toHaveBeenCalledWith(null);
  });

  it('disables Clear Filters until a filter or search is active', () => {
    const onClearFilters = vi.fn();
    const { rerender } = renderWithProviders(
      <UserToolbar {...baseProps} hasActiveFilters={false} onClearFilters={onClearFilters} />,
    );

    expect(screen.getByRole('button', { name: 'Clear Filters' })).toBeDisabled();

    rerender(<UserToolbar {...baseProps} hasActiveFilters onClearFilters={onClearFilters} />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear Filters' }));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });

  it('fires onRefresh and shows the loading state while refreshing', () => {
    const onRefresh = vi.fn();
    const { rerender } = renderWithProviders(
      <UserToolbar {...baseProps} onRefresh={onRefresh} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);

    rerender(<UserToolbar {...baseProps} onRefresh={onRefresh} refreshing />);
    expect(screen.getByRole('button', { name: 'Refresh' })).toHaveAttribute('aria-busy', 'true');
  });

  it('renders an Add User action when onAddUser is provided', () => {
    const onAddUser = vi.fn();
    renderWithProviders(<UserToolbar {...baseProps} onAddUser={onAddUser} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add User' }));
    expect(onAddUser).toHaveBeenCalledTimes(1);
  });

  it('does not render an Add User action when onAddUser is omitted', () => {
    renderWithProviders(<UserToolbar {...baseProps} />);
    expect(screen.queryByRole('button', { name: 'Add User' })).not.toBeInTheDocument();
  });
});
