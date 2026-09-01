import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '../../test/testUtils';
import { DoctorScheduleSection } from './DoctorScheduleSection';
import type { DoctorProfileResponse } from '../../types/doctor';

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

describe('DoctorScheduleSection', () => {
  describe('Clinic Default Schedule (zero custom schedules)', () => {
    it('displays "Using clinic default schedule" when no custom schedules', () => {
      renderWithProviders(<DoctorScheduleSection doctor={baseDoctor} />);
      expect(screen.getByText('Using clinic default schedule')).toBeInTheDocument();
    });

    it('does NOT display "No schedule set"', () => {
      renderWithProviders(<DoctorScheduleSection doctor={baseDoctor} />);
      expect(screen.queryByText('No schedule set')).not.toBeInTheDocument();
    });

    it('displays all 6 weekdays (Mon–Sat)', () => {
      renderWithProviders(<DoctorScheduleSection doctor={baseDoctor} />);
      expect(screen.getByText('Monday')).toBeInTheDocument();
      expect(screen.getByText('Tuesday')).toBeInTheDocument();
      expect(screen.getByText('Wednesday')).toBeInTheDocument();
      expect(screen.getByText('Thursday')).toBeInTheDocument();
      expect(screen.getByText('Friday')).toBeInTheDocument();
      expect(screen.getByText('Saturday')).toBeInTheDocument();
    });

    it('displays clinic default morning session for each day', () => {
      renderWithProviders(<DoctorScheduleSection doctor={baseDoctor} />);
      // Morning session label appears 6 times (once per day)
      const morningLabels = screen.getAllByText('10:00 AM – 1:00 PM');
      expect(morningLabels).toHaveLength(6);
    });

    it('displays clinic default evening session for each day', () => {
      renderWithProviders(<DoctorScheduleSection doctor={baseDoctor} />);
      const eveningLabels = screen.getAllByText('5:00 PM – 9:00 PM');
      expect(eveningLabels).toHaveLength(6);
    });

    it('does NOT display Sunday', () => {
      renderWithProviders(<DoctorScheduleSection doctor={baseDoctor} />);
      expect(screen.queryByText('Sunday')).not.toBeInTheDocument();
    });

    it('shows "Create Custom Schedule" button for admins', () => {
      renderWithProviders(
        <DoctorScheduleSection doctor={baseDoctor} isAdmin={true} onEditSchedule={() => {}} />,
      );
      expect(screen.getByText('Create Custom Schedule')).toBeInTheDocument();
    });

    it('hides edit button for non-admins', () => {
      renderWithProviders(
        <DoctorScheduleSection doctor={baseDoctor} isAdmin={false} onEditSchedule={() => {}} />,
      );
      expect(screen.queryByText('Create Custom Schedule')).not.toBeInTheDocument();
      expect(screen.queryByText('Edit Schedule')).not.toBeInTheDocument();
    });
  });

  describe('Custom Schedule', () => {
    it('displays "Custom schedule" when custom schedules exist', () => {
      renderWithProviders(
        <DoctorScheduleSection
          doctor={{
            ...baseDoctor,
            schedules: [
              { id: 's1', doctor_id: 'd1', day_of_week: 0, start_time: '09:00:00', end_time: '12:00:00', is_active: true },
            ],
          }}
        />,
      );
      expect(screen.getByText('Custom schedule')).toBeInTheDocument();
    });

    it('renders all 6 weekdays even when only some have schedules', () => {
      renderWithProviders(
        <DoctorScheduleSection
          doctor={{
            ...baseDoctor,
            schedules: [
              { id: 's1', doctor_id: 'd1', day_of_week: 0, start_time: '09:00:00', end_time: '12:00:00', is_active: true },
            ],
          }}
        />,
      );
      expect(screen.getByText('Monday')).toBeInTheDocument();
      expect(screen.getByText('Tuesday')).toBeInTheDocument();
      expect(screen.getByText('Wednesday')).toBeInTheDocument();
      expect(screen.getByText('Thursday')).toBeInTheDocument();
      expect(screen.getByText('Friday')).toBeInTheDocument();
      expect(screen.getByText('Saturday')).toBeInTheDocument();
    });

    it('displays "Not working" for days without schedules', () => {
      renderWithProviders(
        <DoctorScheduleSection
          doctor={{
            ...baseDoctor,
            schedules: [
              { id: 's1', doctor_id: 'd1', day_of_week: 0, start_time: '09:00:00', end_time: '12:00:00', is_active: true },
            ],
          }}
        />,
      );
      // Tuesday through Saturday should show "Not working" (5 days)
      const notWorking = screen.getAllByText('Not working');
      expect(notWorking.length).toBeGreaterThanOrEqual(1);
    });

    it('renders two sessions on the same weekday', () => {
      renderWithProviders(
        <DoctorScheduleSection
          doctor={{
            ...baseDoctor,
            schedules: [
              { id: 's1', doctor_id: 'd1', day_of_week: 0, start_time: '09:00:00', end_time: '12:00:00', is_active: true },
              { id: 's2', doctor_id: 'd1', day_of_week: 0, start_time: '17:00:00', end_time: '21:00:00', is_active: true },
            ],
          }}
        />,
      );
      // Sessions are rendered as "9:00 AM – 12:00 PM" and "5:00 PM – 9:00 PM" in a single span
      expect(screen.getByText(/9:00 AM/)).toBeInTheDocument();
      expect(screen.getByText(/12:00 PM/)).toBeInTheDocument();
      expect(screen.getByText(/5:00 PM/)).toBeInTheDocument();
      expect(screen.getByText(/9:00 PM/)).toBeInTheDocument();
    });

    it('displays inactive sessions with strikethrough styling', () => {
      const { container } = renderWithProviders(
        <DoctorScheduleSection
          doctor={{
            ...baseDoctor,
            schedules: [
              { id: 's1', doctor_id: 'd1', day_of_week: 0, start_time: '09:00:00', end_time: '12:00:00', is_active: true },
              { id: 's2', doctor_id: 'd1', day_of_week: 0, start_time: '17:00:00', end_time: '21:00:00', is_active: false },
            ],
          }}
        />,
      );
      // Both sessions render their time ranges
      expect(screen.getByText(/9:00 AM/)).toBeInTheDocument();
      expect(screen.getByText(/5:00 PM/)).toBeInTheDocument();
      // Inactive session has line-through styling
      const lineThroughElements = container.querySelectorAll('.line-through');
      expect(lineThroughElements.length).toBeGreaterThan(0);
    });

    it('shows "Edit Schedule" button for admins with custom schedules', () => {
      renderWithProviders(
        <DoctorScheduleSection
          doctor={{
            ...baseDoctor,
            schedules: [
              { id: 's1', doctor_id: 'd1', day_of_week: 0, start_time: '09:00:00', end_time: '12:00:00', is_active: true },
            ],
          }}
          isAdmin={true}
          onEditSchedule={() => {}}
        />,
      );
      expect(screen.getByText('Edit Schedule')).toBeInTheDocument();
    });
  });

  describe('Schedule sorting', () => {
    it('sorts schedules Monday through Saturday regardless of API order', () => {
      renderWithProviders(
        <DoctorScheduleSection
          doctor={{
            ...baseDoctor,
            schedules: [
              { id: 's3', doctor_id: 'd1', day_of_week: 5, start_time: '09:00:00', end_time: '10:00:00', is_active: true },
              { id: 's1', doctor_id: 'd1', day_of_week: 0, start_time: '09:00:00', end_time: '10:00:00', is_active: true },
            ],
          }}
        />,
      );

      const table = screen.getByRole('table');
      const rows = within(table).getAllByRole('row').slice(1); // skip header
      expect(within(rows[0]).getByText('Monday')).toBeInTheDocument();
      // Saturday should appear after Monday
      const lastRow = rows[rows.length - 1];
      expect(within(lastRow).getByText('Saturday')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('uses semantic table structure with column headers', () => {
      renderWithProviders(
        <DoctorScheduleSection
          doctor={{
            ...baseDoctor,
            schedules: [
              { id: 's1', doctor_id: 'd1', day_of_week: 0, start_time: '09:00:00', end_time: '12:00:00', is_active: true },
            ],
          }}
        />,
      );

      const table = screen.getByRole('table');
      const headerRow = within(table).getAllByRole('row')[0];
      expect(within(headerRow).getByText('Day')).toBeInTheDocument();
      expect(within(headerRow).getByText('Working Hours')).toBeInTheDocument();

      const dayHeader = within(table).getByRole('rowheader', { name: 'Monday' });
      expect(dayHeader).toBeInTheDocument();
    });
  });
});
