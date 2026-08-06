import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../test/testUtils';
import { DoctorStatusDialog } from './DoctorStatusDialog';
import type { DoctorResponse } from '../../types/doctor';

const doctor: DoctorResponse = {
  id: 'd1',
  doctor_code: 'DOC-000001',
  user_id: 3,
  user_full_name: 'Dr. Jose Rizal',
  user_email: 'jose@clinic.com',
  date_of_birth: '1985-04-12',
  gender: 'male',
  primary_phone: '+639123456789',
  address: null,
  qualification: null,
  registration_number: null,
  years_of_experience: 12,
  consultation_fee: 800,
  consultation_duration: 30,
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
  updated_at: '2024-01-01T00:00:00',
};

const baseProps = {
  open: true,
  doctor,
  intent: 'deactivate' as const,
  onConfirm: vi.fn(),
  onClose: vi.fn(),
};

describe('DoctorStatusDialog', () => {
  it('does not render when closed', () => {
    renderWithProviders(<DoctorStatusDialog {...baseProps} open={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the deactivate confirmation', () => {
    renderWithProviders(<DoctorStatusDialog {...baseProps} />);
    expect(screen.getByRole('dialog', { name: 'Deactivate doctor' })).toBeInTheDocument();
    expect(screen.getByText('Deactivate Doctor')).toBeInTheDocument();
    expect(screen.getByText('DOC-000001')).toBeInTheDocument();
    // The copy is split across spans, so match the key fragments.
    expect(screen.getByText('Dr. Jose Rizal')).toBeInTheDocument();
    expect(screen.getByText('deactivated')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deactivate' })).toBeInTheDocument();
  });

  it('renders the activate confirmation', () => {
    renderWithProviders(
      <DoctorStatusDialog {...baseProps} intent="activate" />,
    );
    expect(screen.getByRole('dialog', { name: 'Activate doctor' })).toBeInTheDocument();
    expect(screen.getByText('Activate Doctor')).toBeInTheDocument();
    expect(screen.getByText('activated')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Activate' })).toBeInTheDocument();
  });

  it('calls onConfirm when the confirm button is clicked', () => {
    const onConfirm = vi.fn();
    renderWithProviders(<DoctorStatusDialog {...baseProps} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when cancel is clicked', () => {
    const onClose = vi.fn();
    renderWithProviders(<DoctorStatusDialog {...baseProps} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows backend errors surfaced by the container', () => {
    renderWithProviders(
      <DoctorStatusDialog {...baseProps} error="Doctor is already inactive." />,
    );
    expect(screen.getByText('Doctor is already inactive.')).toBeInTheDocument();
  });

  it('disables buttons while submitting', () => {
    renderWithProviders(<DoctorStatusDialog {...baseProps} submitting />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});
