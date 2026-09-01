import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/testUtils';
import { DoctorDetailsContainer } from './containers/DoctorDetailsContainer';
import { doctorService } from '../../services/doctorService';
import type { DoctorProfileResponse, ScheduleResponse } from '../../types/doctor';

/* ── Mocks ──────────────────────────────────────────────────────────────── */

vi.mock('../../services/doctorService', () => ({
  doctorService: {
    getProfile: vi.fn(),
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    activate: vi.fn(),
    deactivate: vi.fn(),
    toggleLeave: vi.fn(),
    toggleAvailability: vi.fn(),
    replaceWeekSchedule: vi.fn(),
    createSchedule: vi.fn(),
    updateSchedule: vi.fn(),
    deleteSchedule: vi.fn(),
    listSpecializations: vi.fn(),
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ doctorId: 'd1' }),
  };
});

const mockUsePermission = vi.fn();
vi.mock('../../hooks/rbac/usePermission', () => ({
  usePermission: (...args: unknown[]) => mockUsePermission(...args),
}));

vi.mock('../../services/apiError', () => ({
  parseApiError: (err: unknown) => ({
    message: err instanceof Error ? err.message : 'Unknown error',
    kind: 'unknown' as const,
  }),
}));

const getProfileMock = vi.mocked(doctorService.getProfile);
const replaceWeekScheduleMock = vi.mocked(doctorService.replaceWeekSchedule);

/* ── Fixtures ───────────────────────────────────────────────────────────── */

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
    { id: 's1', doctor_id: 'd1', day_of_week: 0, start_time: '09:00:00', end_time: '12:00:00', is_active: true },
    { id: 's2', doctor_id: 'd1', day_of_week: 0, start_time: '17:00:00', end_time: '21:00:00', is_active: true },
  ],
};

const scheduleResponse: ScheduleResponse = {
  id: 's1',
  doctor_id: 'd1',
  day_of_week: 0,
  start_time: '10:00:00',
  end_time: '13:00:00',
  is_active: true,
};

/* ── Helpers ────────────────────────────────────────────────────────────── */

function setupPermissionAdmin() {
  mockUsePermission.mockReturnValue({
    isAdmin: true,
    isResolved: true,
    role: 'ADMIN',
    state: { status: 'admin', role: { role_id: 1, role_name: 'ADMIN' } },
    can: () => true,
  });
}

function setupPermissionNonAdmin() {
  mockUsePermission.mockReturnValue({
    isAdmin: false,
    isResolved: true,
    role: null,
    state: { status: 'non-admin', role: null },
    can: () => false,
  });
}

function setupDoctor(doctor: DoctorProfileResponse = baseDoctor) {
  getProfileMock.mockResolvedValue(doctor);
  replaceWeekScheduleMock.mockResolvedValue([scheduleResponse]);
}

/* ── Tests ──────────────────────────────────────────────────────────────── */

describe('DoctorDetailsContainer — Schedule Management Wiring (F-0)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePermission.mockReset();
  });

  describe('1. Admin + default schedule: Create Custom Schedule button visible', () => {
    it('shows Create Custom Schedule button when admin and zero custom schedules', async () => {
      setupPermissionAdmin();
      setupDoctor(baseDoctor);

      renderWithProviders(<DoctorDetailsContainer />, { route: '/doctors/d1' });

      await waitFor(() => {
        expect(screen.getByText('Create Custom Schedule')).toBeInTheDocument();
      });
    });
  });

  describe('2. Admin + custom schedule: Edit Schedule button visible', () => {
    it('shows Edit Schedule button when admin and custom schedules exist', async () => {
      setupPermissionAdmin();
      setupDoctor(doctorWithCustomSchedule);

      renderWithProviders(<DoctorDetailsContainer />, { route: '/doctors/d1' });

      await waitFor(() => {
        expect(screen.getByText('Edit Schedule')).toBeInTheDocument();
      });
    });
  });

  describe('3. Non-admin: schedule action buttons absent', () => {
    it('hides Create Custom Schedule for non-admin', async () => {
      setupPermissionNonAdmin();
      setupDoctor(baseDoctor);

      renderWithProviders(<DoctorDetailsContainer />, { route: '/doctors/d1' });

      await waitFor(() => {
        expect(screen.getByText('Working Schedule')).toBeInTheDocument();
      });
      expect(screen.queryByText('Create Custom Schedule')).not.toBeInTheDocument();
      expect(screen.queryByText('Edit Schedule')).not.toBeInTheDocument();
    });
  });

  describe('4. Clicking Create opens DoctorScheduleEditor', () => {
    it('opens the schedule editor when Create Custom Schedule is clicked', async () => {
      setupPermissionAdmin();
      setupDoctor(baseDoctor);
      const user = userEvent.setup();

      renderWithProviders(<DoctorDetailsContainer />, { route: '/doctors/d1' });

      await waitFor(() => {
        expect(screen.getByText('Create Custom Schedule')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Create Custom Schedule'));

      await waitFor(() => {
        expect(screen.getByText('Edit Weekly Schedule')).toBeInTheDocument();
      });
    });
  });

  describe('5. Clicking Edit opens DoctorScheduleEditor', () => {
    it('opens the schedule editor when Edit Schedule is clicked', async () => {
      setupPermissionAdmin();
      setupDoctor(doctorWithCustomSchedule);
      const user = userEvent.setup();

      renderWithProviders(<DoctorDetailsContainer />, { route: '/doctors/d1' });

      await waitFor(() => {
        expect(screen.getByText('Edit Schedule')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Edit Schedule'));

      await waitFor(() => {
        expect(screen.getByText('Edit Weekly Schedule')).toBeInTheDocument();
      });
    });
  });

  describe('6. Default-mode editor seeds clinic default sessions', () => {
    it('shows clinic default info banner in editor for zero schedules', async () => {
      setupPermissionAdmin();
      setupDoctor(baseDoctor);
      const user = userEvent.setup();

      renderWithProviders(<DoctorDetailsContainer />, { route: '/doctors/d1' });

      await waitFor(() => {
        expect(screen.getByText('Create Custom Schedule')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Create Custom Schedule'));

      await waitFor(() => {
        expect(screen.getByText(/Pre-populated with clinic default hours/)).toBeInTheDocument();
      });
    });
  });

  describe('7. Custom-mode editor seeds actual explicit sessions', () => {
    it('shows custom schedule info banner in editor for existing schedules', async () => {
      setupPermissionAdmin();
      setupDoctor(doctorWithCustomSchedule);
      const user = userEvent.setup();

      renderWithProviders(<DoctorDetailsContainer />, { route: '/doctors/d1' });

      await waitFor(() => {
        expect(screen.getByText('Edit Schedule')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Edit Schedule'));

      await waitFor(() => {
        expect(screen.getByText(/Editing the existing custom schedule/)).toBeInTheDocument();
      });
    });
  });

  describe('8. Save calls weekly replace with correct doctor UUID', () => {
    it('calls replaceWeekSchedule with doctor id and schedule payload', async () => {
      setupPermissionAdmin();
      setupDoctor(baseDoctor);
      const user = userEvent.setup();

      renderWithProviders(<DoctorDetailsContainer />, { route: '/doctors/d1' });

      await waitFor(() => {
        expect(screen.getByText('Create Custom Schedule')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Create Custom Schedule'));

      await waitFor(() => {
        expect(screen.getByText('Save Schedule')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('save-schedule'));

      await waitFor(() => {
        expect(replaceWeekScheduleMock).toHaveBeenCalledWith('d1', expect.any(Array));
      });
    });
  });

  describe('9. Save preserves two same-day non-overlapping sessions', () => {
    it('sends two non-overlapping Monday sessions in the payload', async () => {
      setupPermissionAdmin();
      setupDoctor(doctorWithCustomSchedule);
      const user = userEvent.setup();

      renderWithProviders(<DoctorDetailsContainer />, { route: '/doctors/d1' });

      await waitFor(() => {
        expect(screen.getByText('Edit Schedule')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Edit Schedule'));

      await waitFor(() => {
        expect(screen.getByText('Save Schedule')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('save-schedule'));

      await waitFor(() => {
        expect(replaceWeekScheduleMock).toHaveBeenCalled();
      });

      const callArg = replaceWeekScheduleMock.mock.calls[0];
      const schedules = callArg[1] as Array<{ day_of_week: number; start_time: string; end_time: string }>;
      const mondaySessions = schedules.filter((s) => s.day_of_week === 0);
      expect(mondaySessions).toHaveLength(2);
      expect(mondaySessions[0].start_time).toBe('09:00');
      expect(mondaySessions[0].end_time).toBe('12:00');
      expect(mondaySessions[1].start_time).toBe('17:00');
      expect(mondaySessions[1].end_time).toBe('21:00');
    });
  });

  describe('10. Successful save refreshes Doctor Details', () => {
    it('closes editor on successful save (profileQuery refetches via cache invalidation)', async () => {
      setupPermissionAdmin();
      setupDoctor(baseDoctor);
      const user = userEvent.setup();

      renderWithProviders(<DoctorDetailsContainer />, { route: '/doctors/d1' });

      await waitFor(() => {
        expect(screen.getByText('Create Custom Schedule')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Create Custom Schedule'));

      await waitFor(() => {
        expect(screen.getByTestId('save-schedule')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('save-schedule'));

      await waitFor(() => {
        expect(screen.queryByText('Edit Weekly Schedule')).not.toBeInTheDocument();
      });
    });
  });

  describe('11. Mutation failure displays error and preserves recoverable UI', () => {
    it('shows error message when save fails and keeps editor open', async () => {
      setupPermissionAdmin();
      setupDoctor(baseDoctor);
      replaceWeekScheduleMock.mockRejectedValue(new Error('Overlap detected on Monday'));
      const user = userEvent.setup();

      renderWithProviders(<DoctorDetailsContainer />, { route: '/doctors/d1' });

      await waitFor(() => {
        expect(screen.getByText('Create Custom Schedule')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Create Custom Schedule'));

      await waitFor(() => {
        expect(screen.getByTestId('save-schedule')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('save-schedule'));

      await waitFor(() => {
        expect(screen.getByText('Overlap detected on Monday')).toBeInTheDocument();
      });
      // Editor should still be open
      expect(screen.getByText('Edit Weekly Schedule')).toBeInTheDocument();
    });
  });

  describe('12. Cancel closes without mutation', () => {
    it('closes editor and does not call replaceWeekSchedule', async () => {
      setupPermissionAdmin();
      setupDoctor(baseDoctor);
      const user = userEvent.setup();

      renderWithProviders(<DoctorDetailsContainer />, { route: '/doctors/d1' });

      await waitFor(() => {
        expect(screen.getByText('Create Custom Schedule')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Create Custom Schedule'));

      await waitFor(() => {
        expect(screen.getByTestId('cancel-schedule')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('cancel-schedule'));

      await waitFor(() => {
        expect(screen.queryByText('Edit Weekly Schedule')).not.toBeInTheDocument();
      });
      expect(replaceWeekScheduleMock).not.toHaveBeenCalled();
    });
  });

  describe('14. Revert action available for custom schedule', () => {
    it('shows Revert to Clinic Default button when custom schedules exist', async () => {
      setupPermissionAdmin();
      setupDoctor(doctorWithCustomSchedule);

      renderWithProviders(<DoctorDetailsContainer />, { route: '/doctors/d1' });

      await waitFor(() => {
        expect(screen.getByTestId('revert-schedule-button')).toBeInTheDocument();
      });
    });
  });

  describe('15. Revert opens DoctorScheduleRevertDialog', () => {
    it('opens revert dialog when Revert button is clicked', async () => {
      setupPermissionAdmin();
      setupDoctor(doctorWithCustomSchedule);
      const user = userEvent.setup();

      renderWithProviders(<DoctorDetailsContainer />, { route: '/doctors/d1' });

      await waitFor(() => {
        expect(screen.getByTestId('revert-schedule-button')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('revert-schedule-button'));

      await waitFor(() => {
        expect(screen.getByText('Revert to Clinic Default Schedule')).toBeInTheDocument();
      });
    });
  });

  describe('16. Confirm revert calls replace with []', () => {
    it('calls replaceWeekSchedule with empty array on confirm', async () => {
      setupPermissionAdmin();
      setupDoctor(doctorWithCustomSchedule);
      const user = userEvent.setup();

      renderWithProviders(<DoctorDetailsContainer />, { route: '/doctors/d1' });

      await waitFor(() => {
        expect(screen.getByTestId('revert-schedule-button')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('revert-schedule-button'));

      await waitFor(() => {
        expect(screen.getByTestId('confirm-revert')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('confirm-revert'));

      await waitFor(() => {
        expect(replaceWeekScheduleMock).toHaveBeenCalledWith('d1', []);
      });
    });
  });

  describe('17. Revert success returns display to Clinic Default', () => {
    it('closes revert dialog on success', async () => {
      setupPermissionAdmin();
      setupDoctor(doctorWithCustomSchedule);
      const user = userEvent.setup();

      renderWithProviders(<DoctorDetailsContainer />, { route: '/doctors/d1' });

      await waitFor(() => {
        expect(screen.getByTestId('revert-schedule-button')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('revert-schedule-button'));

      await waitFor(() => {
        expect(screen.getByTestId('confirm-revert')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('confirm-revert'));

      await waitFor(() => {
        expect(screen.queryByText('Revert to Clinic Default Schedule')).not.toBeInTheDocument();
      });
    });
  });

  describe('18. Revert failure is surfaced', () => {
    it('shows error when revert fails', async () => {
      setupPermissionAdmin();
      setupDoctor(doctorWithCustomSchedule);
      replaceWeekScheduleMock.mockRejectedValue(new Error('Revert failed'));
      const user = userEvent.setup();

      renderWithProviders(<DoctorDetailsContainer />, { route: '/doctors/d1' });

      await waitFor(() => {
        expect(screen.getByTestId('revert-schedule-button')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('revert-schedule-button'));

      await waitFor(() => {
        expect(screen.getByTestId('confirm-revert')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('confirm-revert'));

      await waitFor(() => {
        expect(screen.getByText('Revert failed')).toBeInTheDocument();
      });
      expect(screen.getByText('Revert to Clinic Default Schedule')).toBeInTheDocument();
    });
  });

  describe('20. Working Schedule remains visible after all changes', () => {
    it('keeps schedule section visible after save', async () => {
      setupPermissionAdmin();
      setupDoctor(baseDoctor);
      const user = userEvent.setup();

      renderWithProviders(<DoctorDetailsContainer />, { route: '/doctors/d1' });

      await waitFor(() => {
        expect(screen.getByText('Working Schedule')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Create Custom Schedule'));

      await waitFor(() => {
        expect(screen.getByTestId('save-schedule')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('save-schedule'));

      await waitFor(() => {
        expect(screen.queryByText('Edit Weekly Schedule')).not.toBeInTheDocument();
      });

      expect(screen.getByText('Working Schedule')).toBeInTheDocument();
    });
  });
});
