import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../test/testUtils';
import { DoctorToggleDialog } from './DoctorToggleDialog';
import type { DoctorResponse } from '../../types/doctor';

const doctor: DoctorResponse = {
  id: 'd1',
  doctor_code: 'DOC-000001',
  user_id: 3,
  user_full_name: 'Dr. Jose Rizal',
  user_email: null,
  date_of_birth: null,
  gender: null,
  primary_phone: '+639123456789',
  address: null,
  qualification: null,
  registration_number: null,
  years_of_experience: null,
  consultation_fee: null,
  consultation_duration: null,
  languages_known: null,
  profile_photo_url: null,
  biography: null,
  emergency_contact_name: null,
  emergency_contact_phone: null,
  available_for_appointment: true,
  on_leave: false,
  is_active: true,
  specializations: [],
  created_by: 1,
  updated_by: 1,
  created_at: '2024-01-01T00:00:00',
  updated_at: '2024-06-01T00:00:00',
};

describe('DoctorToggleDialog', () => {
  it('shows Mark Unavailable when the doctor is currently available', () => {
    renderWithProviders(
      <DoctorToggleDialog open doctor={doctor} intent="availability" onConfirm={vi.fn()} onClose={vi.fn()} />,
    );

    expect(screen.getByRole('dialog', { name: 'Mark Unavailable' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark Unavailable' })).toBeInTheDocument();
    expect(screen.getByText(/will be marked unavailable for new appointments/)).toBeInTheDocument();
  });

  it('shows Mark Available when the doctor is currently unavailable', () => {
    renderWithProviders(
      <DoctorToggleDialog
        open
        doctor={{ ...doctor, available_for_appointment: false }}
        intent="availability"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Mark Available' })).toBeInTheDocument();
    expect(screen.getByText(/will be marked available for new appointments/)).toBeInTheDocument();
  });

  it('shows Mark On Leave when the doctor is currently on duty', () => {
    renderWithProviders(
      <DoctorToggleDialog open doctor={doctor} intent="leave" onConfirm={vi.fn()} onClose={vi.fn()} />,
    );

    expect(screen.getByRole('dialog', { name: 'Mark On Leave' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark On Leave' })).toBeInTheDocument();
    expect(screen.getByText(/will be marked on leave/)).toBeInTheDocument();
  });

  it('shows Mark Back On Duty when the doctor is currently on leave', () => {
    renderWithProviders(
      <DoctorToggleDialog
        open
        doctor={{ ...doctor, on_leave: true }}
        intent="leave"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Mark Back On Duty' })).toBeInTheDocument();
    expect(screen.getByText(/will be marked back on duty/)).toBeInTheDocument();
  });

  it('surfaces backend error messages', () => {
    renderWithProviders(
      <DoctorToggleDialog
        open
        doctor={doctor}
        intent="availability"
        error="Inactive doctors cannot be marked available."
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Inactive doctors cannot be marked available.');
  });

  it('calls onConfirm and onClose', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    renderWithProviders(
      <DoctorToggleDialog open doctor={doctor} intent="availability" onConfirm={onConfirm} onClose={onClose} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mark Unavailable' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when intent is null', () => {
    renderWithProviders(
      <DoctorToggleDialog open doctor={doctor} intent={null} onConfirm={vi.fn()} onClose={vi.fn()} />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
