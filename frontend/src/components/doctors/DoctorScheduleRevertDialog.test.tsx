import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/testUtils';
import { DoctorScheduleRevertDialog } from './DoctorScheduleRevertDialog';
import type { DoctorResponse } from '../../types/doctor';

/* ── Fixtures ────────────────────────────────────────────────────────── */

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

function makeProps(overrides: Partial<React.ComponentProps<typeof DoctorScheduleRevertDialog>> = {}) {
  return {
    open: true,
    doctor,
    onConfirm: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

/* ── Tests ───────────────────────────────────────────────────────────── */

describe('DoctorScheduleRevertDialog', () => {
  describe('Rendering', () => {
    it('renders the dialog when open', () => {
      renderWithProviders(<DoctorScheduleRevertDialog {...makeProps()} />);
      expect(screen.getByText('Revert to Clinic Default Schedule')).toBeInTheDocument();
    });

    it('does NOT render when closed', () => {
      renderWithProviders(<DoctorScheduleRevertDialog {...makeProps({ open: false })} />);
      expect(screen.queryByText('Revert to Clinic Default Schedule')).not.toBeInTheDocument();
    });

    it('shows the doctor name', () => {
      renderWithProviders(<DoctorScheduleRevertDialog {...makeProps()} />);
      expect(screen.getByText('Dr. Jose Rizal')).toBeInTheDocument();
    });

    it('shows doctor code when user_full_name is null', () => {
      renderWithProviders(
        <DoctorScheduleRevertDialog {...makeProps({ doctor: { ...doctor, user_full_name: null } })} />,
      );
      expect(screen.getByText('DOC-000001')).toBeInTheDocument();
    });

    it('does not crash when doctor is null', () => {
      renderWithProviders(<DoctorScheduleRevertDialog {...makeProps({ doctor: null })} />);
      expect(screen.getByText('Revert to Clinic Default Schedule')).toBeInTheDocument();
    });
  });

  describe('Content', () => {
    it('explains the clinic default schedule', () => {
      renderWithProviders(<DoctorScheduleRevertDialog {...makeProps()} />);
      expect(screen.getByText(/remove the doctor's custom working schedule/)).toBeInTheDocument();
      expect(screen.getByText(/clinic default schedule/)).toBeInTheDocument();
      expect(screen.getByText('Monday – Saturday')).toBeInTheDocument();
      expect(screen.getByText('Morning: 10:00 AM – 1:00 PM')).toBeInTheDocument();
      expect(screen.getByText('Evening: 5:00 PM – 9:00 PM')).toBeInTheDocument();
    });
  });

  describe('Actions', () => {
    it('calls onConfirm when Revert button is clicked', async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();
      renderWithProviders(<DoctorScheduleRevertDialog {...makeProps({ onConfirm })} />);

      await user.click(screen.getByTestId('confirm-revert'));
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Cancel is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      renderWithProviders(<DoctorScheduleRevertDialog {...makeProps({ onClose })} />);

      await user.click(screen.getByTestId('cancel-revert'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Loading State', () => {
    it('shows "Reverting..." when submitting', () => {
      renderWithProviders(<DoctorScheduleRevertDialog {...makeProps({ submitting: true })} />);
      expect(screen.getByText('Reverting...')).toBeInTheDocument();
      expect(screen.getByTestId('confirm-revert')).toBeDisabled();
    });

    it('Cancel button remains enabled during submission', () => {
      renderWithProviders(<DoctorScheduleRevertDialog {...makeProps({ submitting: true })} />);
      expect(screen.getByTestId('cancel-revert')).not.toBeDisabled();
    });
  });

  describe('Error Display', () => {
    it('displays backend error message', () => {
      renderWithProviders(
        <DoctorScheduleRevertDialog {...makeProps({ error: 'Failed to revert schedule' })} />,
      );
      expect(screen.getByText('Failed to revert schedule')).toBeInTheDocument();
    });

    it('does not show error area when no error', () => {
      renderWithProviders(<DoctorScheduleRevertDialog {...makeProps()} />);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});
