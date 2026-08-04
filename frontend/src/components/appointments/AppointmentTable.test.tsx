import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../test/testUtils';
import { AppointmentTable } from './AppointmentTable';
import type { EnrichedAppointment } from '../../types/appointment';

const appointments: EnrichedAppointment[] = [
  {
    id: 'a1',
    appointment_number: 'APT-20260707-0001',
    patient_id: 'p1',
    dentist_id: 3,
    appointment_date: '2026-07-08',
    start_time: '10:00:00',
    end_time: '10:30:00',
    duration_minutes: 30,
    appointment_type: 'Consultation',
    status: 'Scheduled',
    reason_for_visit: 'Toothache',
    notes: null,
    created_by: 1,
    updated_by: null,
    created_at: '2026-07-07T08:00:00Z',
    updated_at: '2026-07-07T08:00:00Z',
    patient_name: 'Juan Dela Cruz',
    dentist_name: 'Dr. Jose Rizal',
  },
  {
    id: 'a2',
    appointment_number: 'APT-20260707-0002',
    patient_id: 'p2',
    dentist_id: 4,
    appointment_date: '2026-07-08',
    start_time: '14:00:00',
    end_time: '14:45:00',
    duration_minutes: 45,
    appointment_type: 'Procedure',
    status: 'Completed',
    reason_for_visit: 'Cleaning',
    notes: 'Rinse thoroughly.',
    created_by: 1,
    updated_by: 2,
    created_at: '2026-07-07T08:00:00Z',
    updated_at: '2026-07-07T09:00:00Z',
    patient_name: null,
    dentist_name: null,
  },
];

describe('AppointmentTable', () => {
  it('renders appointment rows with number, names, date, time and status', () => {
    renderWithProviders(<AppointmentTable appointments={appointments} />);

    expect(screen.getByText('APT-20260707-0001')).toBeInTheDocument();
    expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument();
    expect(screen.getByText('Dr. Jose Rizal')).toBeInTheDocument();
    // Status values appear both as status badges and as filter options.
    expect(screen.getAllByText('Scheduled').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Completed').length).toBeGreaterThan(0);
  });

  it('falls back to id-based labels when names are unresolved', () => {
    renderWithProviders(<AppointmentTable appointments={[appointments[1]]} />);
    expect(screen.getByText('Patient #p2')).toBeInTheDocument();
    expect(screen.getByText('Dentist #4')).toBeInTheDocument();
  });

  it('is accessible via the table aria-label', () => {
    renderWithProviders(<AppointmentTable appointments={appointments} />);
    expect(screen.getByRole('table', { name: 'Appointments table' })).toBeInTheDocument();
  });

  it('renders the empty state when there are no appointments', () => {
    renderWithProviders(<AppointmentTable appointments={[]} />);
    expect(screen.getByText('No appointments found')).toBeInTheDocument();
  });

  it('renders skeleton rows while loading', () => {
    renderWithProviders(<AppointmentTable appointments={[]} loading />);
    const tbody = screen
      .getByRole('table', { name: 'Appointments table' })
      .querySelector('tbody');
    expect(tbody).toHaveAttribute('aria-busy', 'true');
  });

  it('renders the error state and calls onRetry', () => {
    const onRetry = vi.fn();
    renderWithProviders(
      <AppointmentTable appointments={[]} error="Failed to load data" onRetry={onRetry} />,
    );
    expect(screen.getAllByText('Failed to load data').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('invokes view and edit row actions', () => {
    const onView = vi.fn();
    const onEdit = vi.fn();
    renderWithProviders(
      <AppointmentTable appointments={appointments} onView={onView} onEdit={onEdit} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'View APT-20260707-0001' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit APT-20260707-0001' }));

    expect(onView).toHaveBeenCalledWith(appointments[0]);
    expect(onEdit).toHaveBeenCalledWith(appointments[0]);
  });

  it('disables edit for completed appointments (backend rejects it)', () => {
    renderWithProviders(
      <AppointmentTable appointments={appointments} onEdit={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Edit APT-20260707-0002' })).toBeDisabled();
  });

  it('only shows the cancel action for cancellable statuses', () => {
    const onCancel = vi.fn();
    renderWithProviders(
      <AppointmentTable appointments={appointments} onCancel={onCancel} />,
    );

    // a1 is Scheduled → cancellable; a2 is Completed → no cancel action.
    expect(screen.getByRole('button', { name: 'Cancel APT-20260707-0001' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Cancel APT-20260707-0002' }),
    ).not.toBeInTheDocument();
  });

  it('renders the toolbar with search, status filter and New Appointment CTA', () => {
    renderWithProviders(
      <AppointmentTable
        appointments={appointments}
        searchValue=""
        onSearchChange={vi.fn()}
        statusFilter="all"
        onStatusFilterChange={vi.fn()}
        onCreate={vi.fn()}
      />,
    );

    expect(screen.getByRole('searchbox', { name: 'Search appointments...' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Filter by status' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New Appointment' })).toBeInTheDocument();
  });

  it('reports the status filter change', () => {
    const onStatusFilterChange = vi.fn();
    renderWithProviders(
      <AppointmentTable
        appointments={appointments}
        statusFilter="all"
        onStatusFilterChange={onStatusFilterChange}
      />,
    );

    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by status' }), {
      target: { value: 'Confirmed' },
    });
    expect(onStatusFilterChange).toHaveBeenCalledWith('Confirmed');
  });

  it('renders the empty state with a New Appointment action when onCreate is provided', () => {
    const onCreate = vi.fn();
    renderWithProviders(
      <AppointmentTable appointments={[]} onCreate={onCreate} />,
    );

    expect(screen.getByText('No appointments found')).toBeInTheDocument();
    // Toolbar CTA + empty-state CTA both exist; click the empty-state one.
    const buttons = screen.getAllByRole('button', { name: 'New Appointment' });
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(buttons[buttons.length - 1]);
    expect(onCreate).toHaveBeenCalledTimes(1);
  });
});
