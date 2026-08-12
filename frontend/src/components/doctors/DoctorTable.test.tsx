import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../test/testUtils';
import { DoctorTable } from './DoctorTable';
import type { DoctorResponse } from '../../types/doctor';

const makeDoctor = (overrides: Partial<DoctorResponse> = {}): DoctorResponse => ({
  id: 'd1',
  doctor_code: 'DOC-000001',
  user_id: 3,
  user_full_name: 'Dr. Jose Rizal',
  user_email: 'jose@clinic.com',
  date_of_birth: '1985-04-12',
  gender: 'male',
  primary_phone: '+639123456789',
  address: '123 Rizal St.',
  qualification: 'DMD',
  registration_number: 'DEN-2020-12345',
  years_of_experience: 12,
  consultation_fee: 800,
  consultation_duration: 30,
  languages_known: ['English', 'Filipino'],
  profile_photo_url: null,
  biography: 'Seasoned practitioner.',
  emergency_contact_name: 'Maria Rizal',
  emergency_contact_phone: '+639987654321',
  available_for_appointment: true,
  on_leave: false,
  is_active: true,
  specializations: [
    { specialization_id: 1, specialization_name: 'Orthodontics', specialization_code: 'ORTHO', is_primary: true, certification_date: null },
  ],
  created_by: 1,
  updated_by: 1,
  created_at: '2024-01-01T00:00:00',
  updated_at: '2024-01-01T00:00:00',
  ...overrides,
});

const doctors: DoctorResponse[] = [
  makeDoctor(),
  makeDoctor({
    id: 'd2',
    doctor_code: 'DOC-000002',
    user_id: 4,
    user_full_name: 'Dr. Maria Santos',
    user_email: 'maria@clinic.com',
    primary_phone: '+639987654321',
    years_of_experience: 5,
    consultation_fee: 500,
    is_active: false,
    available_for_appointment: false,
    on_leave: true,
    specializations: [
      { specialization_id: 2, specialization_name: 'Endodontics', specialization_code: 'ENDO', is_primary: true, certification_date: null },
    ],
  }),
];

const defaultProps = {
  doctors,
};

describe('DoctorTable', () => {
  it('renders doctor rows with backend-mapped columns', () => {
    renderWithProviders(<DoctorTable {...defaultProps} />);

    expect(screen.getByText('DOC-000001')).toBeInTheDocument();
    expect(screen.getByText('DOC-000002')).toBeInTheDocument();
    expect(screen.getByText('Dr. Jose Rizal')).toBeInTheDocument();
    expect(screen.getByText('Dr. Maria Santos')).toBeInTheDocument();
    // Primary specialization (resolved from the nested array)
    expect(screen.getByText('Orthodontics')).toBeInTheDocument();
    expect(screen.getByText('Endodontics')).toBeInTheDocument();
    // Phone
    expect(screen.getByText('+639123456789')).toBeInTheDocument();
    // Years + formatted fee
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('₹800.00')).toBeInTheDocument();
    // Status + availability badges
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Inactive').length).toBeGreaterThan(0);
  });

  it('is accessible via the table aria-label', () => {
    renderWithProviders(<DoctorTable {...defaultProps} ariaLabel="Doctors table" />);
    expect(screen.getByRole('table', { name: 'Doctors table' })).toBeInTheDocument();
  });

  it('renders the empty state when there are no doctors', () => {
    renderWithProviders(<DoctorTable {...defaultProps} doctors={[]} />);
    expect(screen.getByText('No doctors found')).toBeInTheDocument();
  });

  it('renders skeleton rows while loading', () => {
    renderWithProviders(<DoctorTable {...defaultProps} loading />);
    const tbody = screen.getByRole('table', { name: 'Doctors table' }).querySelector('tbody');
    expect(tbody).toHaveAttribute('aria-busy', 'true');
  });

  it('renders the error state and calls onRetry', () => {
    const onRetry = vi.fn();
    renderWithProviders(<DoctorTable {...defaultProps} error="Failed to load data" onRetry={onRetry} />);

    expect(screen.getAllByText('Failed to load data').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('invokes row action callbacks', () => {
    const onEdit = vi.fn();
    const onDeactivate = vi.fn();
    renderWithProviders(
      <DoctorTable {...defaultProps} onEdit={onEdit} onDeactivate={onDeactivate} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit Dr. Jose Rizal' }));
    expect(onEdit).toHaveBeenCalledWith(doctors[0]);

    // Only active doctors get a deactivate action
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate Dr. Jose Rizal' }));
    expect(onDeactivate).toHaveBeenCalledWith(doctors[0]);
    expect(screen.queryByRole('button', { name: 'Deactivate Dr. Maria Santos' })).not.toBeInTheDocument();
  });

  it('shows reactivate (not deactivate) for inactive doctors', () => {
    const onReactivate = vi.fn();
    renderWithProviders(<DoctorTable {...defaultProps} onReactivate={onReactivate} />);

    expect(screen.getByRole('button', { name: 'Reactivate Dr. Maria Santos' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reactivate Dr. Jose Rizal' })).not.toBeInTheDocument();
  });

  it('marks doctors on leave as unavailable', () => {
    renderWithProviders(<DoctorTable {...defaultProps} />);
    expect(screen.getAllByText('Available').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Unavailable').length).toBeGreaterThan(0);
  });

  it('renders the consultation fee cell for every supported fee value without crashing', () => {
    const cases: Array<{ label: string; fee: unknown; expected: string }> = [
      { label: 'numeric fee', fee: 800, expected: '₹800.00' },
      { label: 'numeric string fee', fee: '800.00', expected: '₹800.00' },
      { label: 'null fee', fee: null, expected: '—' },
      { label: 'undefined fee', fee: undefined, expected: '—' },
      { label: 'invalid string fee', fee: 'not-a-number', expected: '—' },
    ];

    for (const { fee, expected } of cases) {
      renderWithProviders(
        <DoctorTable {...defaultProps} doctors={[makeDoctor({ consultation_fee: fee as number | null })]} />,
      );
      expect(screen.getAllByText(expected).length).toBeGreaterThan(0);
    }
  });
});
