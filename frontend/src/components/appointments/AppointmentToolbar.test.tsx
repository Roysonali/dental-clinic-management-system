import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../test/testUtils';
import { AppointmentToolbar } from './AppointmentToolbar';

const defaultProps = {
  status: 'all' as const,
  onStatusChange: vi.fn(),
  onCreate: vi.fn(),
  searchValue: '',
  onSearchChange: vi.fn(),
  columnVisibility: {} as Record<string, boolean>,
  onColumnVisibilityChange: vi.fn(),
};

describe('AppointmentToolbar', () => {
  it('renders search, status filter, Columns menu and the New Appointment CTA', () => {
    renderWithProviders(<AppointmentToolbar {...defaultProps} />);

    expect(screen.getByRole('searchbox', { name: 'Search appointments...' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Filter by status' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New Appointment' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Columns' })).toBeInTheDocument();
  });

  it('reports search input changes', () => {
    const onSearchChange = vi.fn();
    renderWithProviders(<AppointmentToolbar {...defaultProps} onSearchChange={onSearchChange} />);

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search appointments...' }), {
      target: { value: 'juan' },
    });

    expect(onSearchChange).toHaveBeenCalledWith('juan');
  });

  it('invokes onCreate from the primary CTA', () => {
    const onCreate = vi.fn();
    renderWithProviders(<AppointmentToolbar {...defaultProps} onCreate={onCreate} />);

    fireEvent.click(screen.getByRole('button', { name: 'New Appointment' }));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('opens the columns visibility menu when column descriptors are provided', () => {
    renderWithProviders(
      <AppointmentToolbar
        {...defaultProps}
        columnVisibility={{ patient: true, status: true }}
        onColumnVisibilityChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Columns' }));
    expect(screen.getByText('Visible columns')).toBeInTheDocument();
  });

  it('toggles column visibility from the menu', () => {
    const onColumnVisibilityChange = vi.fn();
    renderWithProviders(
      <AppointmentToolbar
        {...defaultProps}
        columnVisibility={{ patient: true, status: true }}
        onColumnVisibilityChange={onColumnVisibilityChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Columns' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Patient' }));

    expect(onColumnVisibilityChange).toHaveBeenCalledWith({
      patient: false,
      status: true,
    });
  });
});
