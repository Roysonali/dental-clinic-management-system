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
  it('renders schedule rows with day, times and active status', () => {
    renderWithProviders(
      <DoctorScheduleSection
        doctor={{
          ...baseDoctor,
          schedules: [
            {
              id: 's1',
              doctor_id: 'd1',
              day_of_week: 0,
              start_time: '09:00:00',
              end_time: '12:00:00',
              is_active: true,
            },
            {
              id: 's2',
              doctor_id: 'd1',
              day_of_week: 2,
              start_time: '13:00:00',
              end_time: '17:00:00',
              is_active: false,
            },
          ],
        }}
      />,
    );

    expect(screen.getByText('Weekly Schedule')).toBeInTheDocument();
    expect(screen.getByText('Monday')).toBeInTheDocument();
    expect(screen.getByText('9:00 AM')).toBeInTheDocument();
    expect(screen.getByText('12:00 PM')).toBeInTheDocument();
    expect(screen.getByText('Wednesday')).toBeInTheDocument();
    expect(screen.getByText('1:00 PM')).toBeInTheDocument();
    expect(screen.getByText('5:00 PM')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

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

    const rows = screen.getAllByRole('row').slice(1); // skip header
    expect(within(rows[0]).getByText('Monday')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Saturday')).toBeInTheDocument();
  });

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
    expect(within(headerRow).getByText('Start Time')).toBeInTheDocument();
    expect(within(headerRow).getByText('End Time')).toBeInTheDocument();
    expect(within(headerRow).getByText('Status')).toBeInTheDocument();

    // Day cells use row-header scope
    const dayHeader = within(table).getByRole('rowheader', { name: 'Monday' });
    expect(dayHeader).toBeInTheDocument();
  });

  it('renders the empty state when no schedule is set', () => {
    renderWithProviders(<DoctorScheduleSection doctor={baseDoctor} />);
    expect(screen.getByText('No schedule set')).toBeInTheDocument();
  });
});
