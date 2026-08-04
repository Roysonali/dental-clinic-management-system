import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../test/testUtils';
import { AppointmentFilters } from './AppointmentFilters';

describe('AppointmentFilters', () => {
  it('renders a status select with all filter options', () => {
    renderWithProviders(<AppointmentFilters status="all" onStatusChange={vi.fn()} />);

    const select = screen.getByRole('combobox', { name: 'Filter by status' });
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Scheduled' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Completed' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'No Show' })).toBeInTheDocument();
  });

  it('reports the selected status', () => {
    const onStatusChange = vi.fn();
    renderWithProviders(<AppointmentFilters status="all" onStatusChange={onStatusChange} />);

    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by status' }), {
      target: { value: 'Confirmed' },
    });

    expect(onStatusChange).toHaveBeenCalledWith('Confirmed');
  });

  it('shows the current value', () => {
    renderWithProviders(<AppointmentFilters status="Completed" onStatusChange={vi.fn()} />);
    expect(screen.getByRole('combobox', { name: 'Filter by status' })).toHaveValue('Completed');
  });

  it('can be disabled', () => {
    renderWithProviders(<AppointmentFilters status="all" onStatusChange={vi.fn()} disabled />);
    expect(screen.getByRole('combobox', { name: 'Filter by status' })).toBeDisabled();
  });
});
