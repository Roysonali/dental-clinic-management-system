import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../test/testUtils';
import { CancelAppointmentDialog } from './CancelAppointmentDialog';
import type { EnrichedAppointment } from '../../types/appointment';

const appointment: EnrichedAppointment = {
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
};

describe('CancelAppointmentDialog', () => {
  it('renders nothing when closed', () => {
    renderWithProviders(
      <CancelAppointmentDialog
        open={false}
        appointment={appointment}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the appointment summary and confirmation text', () => {
    renderWithProviders(
      <CancelAppointmentDialog
        open
        appointment={appointment}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Cancel appointment' })).toBeInTheDocument();
    expect(screen.getByText('APT-20260707-0001')).toBeInTheDocument();
    expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument();
  });

  it('calls onConfirm when the user confirms', () => {
    const onConfirm = vi.fn();
    renderWithProviders(
      <CancelAppointmentDialog
        open
        appointment={appointment}
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Yes, Cancel Appointment' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onClose via the keep button', () => {
    const onClose = vi.fn();
    renderWithProviders(
      <CancelAppointmentDialog
        open
        appointment={appointment}
        onConfirm={vi.fn()}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Keep Appointment' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('disables both actions while submitting', () => {
    renderWithProviders(
      <CancelAppointmentDialog
        open
        appointment={appointment}
        submitting
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Keep Appointment' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Yes, Cancel Appointment' })).toBeDisabled();
  });

  it('renders a server error banner', () => {
    renderWithProviders(
      <CancelAppointmentDialog
        open
        appointment={appointment}
        error="Invalid appointment transition: Scheduled → Cancelled"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Invalid appointment transition: Scheduled → Cancelled',
    );
  });
});
