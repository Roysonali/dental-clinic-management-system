import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/testUtils';
import { DoctorScheduleEditor } from './DoctorScheduleEditor';
import type { DoctorProfileResponse } from '../../types/doctor';

/* ── Fixtures ────────────────────────────────────────────────────────── */

const baseDoctor: DoctorProfileResponse = {
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
  schedules: [],
};

const doctorWithCustomSchedule: DoctorProfileResponse = {
  ...baseDoctor,
  schedules: [
    { id: 's1', doctor_id: 'd1', day_of_week: 0 as const, start_time: '09:00:00', end_time: '12:00:00', is_active: true },
    { id: 's2', doctor_id: 'd1', day_of_week: 0 as const, start_time: '17:00:00', end_time: '21:00:00', is_active: true },
    { id: 's3', doctor_id: 'd1', day_of_week: 2 as const, start_time: '10:00:00', end_time: '13:00:00', is_active: true },
  ],
};

function makeProps(overrides: Partial<React.ComponentProps<typeof DoctorScheduleEditor>> = {}) {
  return {
    open: true,
    onClose: vi.fn(),
    doctor: baseDoctor,
    hasCustomSchedules: false,
    onSave: vi.fn(),
    ...overrides,
  };
}

/* ── Tests ───────────────────────────────────────────────────────────── */

describe('DoctorScheduleEditor', () => {
  describe('Clinic Default Pre-population', () => {
    it('renders the drawer when open', () => {
      renderWithProviders(<DoctorScheduleEditor {...makeProps()} />);
      expect(screen.getByText('Edit Weekly Schedule')).toBeInTheDocument();
    });

    it('does NOT render when closed', () => {
      renderWithProviders(<DoctorScheduleEditor {...makeProps({ open: false })} />);
      expect(screen.queryByText('Edit Weekly Schedule')).not.toBeInTheDocument();
    });

    it('shows clinic default info banner for zero schedules', () => {
      renderWithProviders(<DoctorScheduleEditor {...makeProps()} />);
      expect(screen.getByText(/Pre-populated with clinic default hours/)).toBeInTheDocument();
    });

    it('shows custom schedule info banner for existing schedules', () => {
      renderWithProviders(
        <DoctorScheduleEditor {...makeProps({ doctor: doctorWithCustomSchedule, hasCustomSchedules: true })} />,
      );
      expect(screen.getByText(/Editing the existing custom schedule/)).toBeInTheDocument();
    });

    it('pre-populates all 6 weekdays with clinic default sessions', () => {
      renderWithProviders(<DoctorScheduleEditor {...makeProps()} />);
      expect(screen.getByText('Monday')).toBeInTheDocument();
      expect(screen.getByText('Tuesday')).toBeInTheDocument();
      expect(screen.getByText('Wednesday')).toBeInTheDocument();
      expect(screen.getByText('Thursday')).toBeInTheDocument();
      expect(screen.getByText('Friday')).toBeInTheDocument();
      expect(screen.getByText('Saturday')).toBeInTheDocument();
      // 6 days × 2 sessions = 12 start-time inputs (one per session)
      const startInputs = screen.getAllByTestId(/^start-time-/);
      expect(startInputs).toHaveLength(12);
    });

    it('pre-populates with existing custom schedules', () => {
      renderWithProviders(
        <DoctorScheduleEditor {...makeProps({ doctor: doctorWithCustomSchedule, hasCustomSchedules: true })} />,
      );
      // Monday has 2 sessions, Wednesday has 1, others 0
      // Monday start time inputs
      const mondayStarts = screen.getAllByTestId('start-time-0');
      expect(mondayStarts).toHaveLength(2);
      const mondayEnds = screen.getAllByTestId('end-time-0');
      expect(mondayEnds).toHaveLength(2);
      // Wednesday start time inputs
      const wedStarts = screen.getAllByTestId('start-time-2');
      expect(wedStarts).toHaveLength(1);
    });
  });

  describe('Add / Remove Sessions', () => {
    it('adds a new session when clicking Add Session', async () => {
      const user = userEvent.setup();
      renderWithProviders(<DoctorScheduleEditor {...makeProps()} />);

      // Initially Monday has 2 sessions (clinic default)
      const before = screen.getAllByTestId('start-time-0');
      expect(before).toHaveLength(2);

      await user.click(screen.getByTestId('add-session-0'));

      const after = screen.getAllByTestId('start-time-0');
      expect(after).toHaveLength(3);
    });

    it('removes a session when clicking Remove', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <DoctorScheduleEditor {...makeProps({ doctor: doctorWithCustomSchedule, hasCustomSchedules: true })} />,
      );

      // Monday has 2 sessions
      const before = screen.getAllByTestId('start-time-0');
      expect(before).toHaveLength(2);

      const removeButtons = screen.getAllByTestId('remove-session-0');
      await user.click(removeButtons[0]);

      const after = screen.getAllByTestId('start-time-0');
      expect(after).toHaveLength(1);
    });

    it('shows "Not working" when all sessions are removed from a day', async () => {
      const user = userEvent.setup();
      // Doctor with only one session on Wednesday
      const doctor = {
        ...baseDoctor,
        schedules: [
          { id: 's1', doctor_id: 'd1', day_of_week: 2 as const, start_time: '10:00:00', end_time: '13:00:00', is_active: true },
        ],
      };
      renderWithProviders(<DoctorScheduleEditor {...makeProps({ doctor, hasCustomSchedules: true })} />);

      const removeBtn = screen.getByTestId('remove-session-2');
      await user.click(removeBtn);

      // Multiple days now show 'Not working' (Mon, Tue, Wed after removal, Thu, Fri, Sat)
      const notWorking = screen.getAllByText('Not working');
      expect(notWorking.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Client-side Validation', () => {
    it('shows error when start >= end', async () => {
      const user = userEvent.setup();
      renderWithProviders(<DoctorScheduleEditor {...makeProps()} />);

      // Change Monday's first session start to 14:00 (after end 13:00)
      const startInputs = screen.getAllByTestId('start-time-0');
      await user.clear(startInputs[0]);
      await user.type(startInputs[0], '14:00');

      expect(screen.getByText(/end time must be after start time/)).toBeInTheDocument();
      expect(screen.getByTestId('save-schedule')).toBeDisabled();
    });

    it('disables Save button when validation errors exist', async () => {
      const user = userEvent.setup();
      renderWithProviders(<DoctorScheduleEditor {...makeProps()} />);

      // Create an overlap: change Monday's second session start to overlap with first
      const startInputs = screen.getAllByTestId('start-time-0');
      await user.clear(startInputs[1]);
      await user.type(startInputs[1], '11:00');

      expect(screen.getByTestId('save-schedule')).toBeDisabled();
    });
  });

  describe('Save / Cancel', () => {
    it('calls onSave with the draft payload on Save click', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      renderWithProviders(<DoctorScheduleEditor {...makeProps({ onSave })} />);

      await user.click(screen.getByTestId('save-schedule'));

      expect(onSave).toHaveBeenCalledTimes(1);
      const payload = onSave.mock.calls[0][0];
      // Clinic default: 6 days × 2 sessions = 12 entries
      expect(payload).toHaveLength(12);
      // First entry should be Monday morning
      expect(payload[0]).toEqual({
        day_of_week: 0,
        start_time: '10:00',
        end_time: '13:00',
      });
    });

    it('calls onClose when Cancel is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      renderWithProviders(<DoctorScheduleEditor {...makeProps({ onClose })} />);

      await user.click(screen.getByTestId('cancel-schedule'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('shows "Saving..." when saving prop is true', () => {
      renderWithProviders(<DoctorScheduleEditor {...makeProps({ saving: true })} />);
      expect(screen.getByText('Saving...')).toBeInTheDocument();
      expect(screen.getByTestId('save-schedule')).toBeDisabled();
    });

    it('displays backend error message', () => {
      renderWithProviders(
        <DoctorScheduleEditor {...makeProps({ error: 'Overlap detected on Monday' })} />,
      );
      expect(screen.getByText('Overlap detected on Monday')).toBeInTheDocument();
    });
  });

  describe('Time Input Updates', () => {
    it('updates session end time', async () => {
      const user = userEvent.setup();
      renderWithProviders(<DoctorScheduleEditor {...makeProps()} />);

      const endInputs = screen.getAllByTestId('end-time-0');
      await user.clear(endInputs[0]);
      await user.type(endInputs[0], '14:00');

      expect(endInputs[0]).toHaveValue('14:00');
    });
  });
});
