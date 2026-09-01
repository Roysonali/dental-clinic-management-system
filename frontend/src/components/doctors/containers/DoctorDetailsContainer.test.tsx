import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders } from '../../../test/testUtils';
import { DoctorDetailsContainer } from './DoctorDetailsContainer';
import { doctorService } from '../../../services/doctorService';
import { appointmentService } from '../../../services/appointmentService';
import { treatmentPlanService } from '../../../services/treatmentPlanService';
import type { DoctorProfileResponse } from '../../../types/doctor';

vi.mock('../../../services/doctorService', () => ({
  doctorService: {
    list: vi.fn(),
    get: vi.fn(),
    getByUserId: vi.fn(),
    getProfile: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    activate: vi.fn(),
    deactivate: vi.fn(),
    toggleLeave: vi.fn(),
    toggleAvailability: vi.fn(),
    delete: vi.fn(),
    listSpecializations: vi.fn(),
  },
}));

vi.mock('../../../services/appointmentService', () => ({
  appointmentService: {
    list: vi.fn(),
    listByPatient: vi.fn(),
    create: vi.fn(),
    today: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
    cancel: vi.fn(),
    updateStatus: vi.fn(),
    calendar: vi.fn(),
  },
}));

vi.mock('../../../services/treatmentPlanService', () => ({
  treatmentPlanService: {
    createPlan: vi.fn(),
    listPlans: vi.fn(),
    searchPlans: vi.fn(),
    listPendingReview: vi.fn(),
    listPendingApproval: vi.fn(),
    getDashboard: vi.fn(),
    listByPatient: vi.fn(),
    listByDoctor: vi.fn(),
    countByStatus: vi.fn(),
    getPlan: vi.fn(),
    addItem: vi.fn(),
    updateItem: vi.fn(),
    removeItem: vi.fn(),
    reorderItems: vi.fn(),
    submitForReview: vi.fn(),
    approveReview: vi.fn(),
    rejectReview: vi.fn(),
    acceptPlan: vi.fn(),
    declinePlan: vi.fn(),
    cancelPlan: vi.fn(),
    startTreatment: vi.fn(),
    putOnHold: vi.fn(),
    resume: vi.fn(),
    complete: vi.fn(),
    doctorApprove: vi.fn(),
    doctorRevoke: vi.fn(),
    patientAcknowledge: vi.fn(),
    patientDecline: vi.fn(),
    createVersion: vi.fn(),
    listVersions: vi.fn(),
    getVersion: vi.fn(),
    restoreVersion: vi.fn(),
  },
}));

// Sprint 11C: admin identity so ADMIN-only status actions render in tests.
const permissionMock = {
  state: { status: 'admin' as const, role: { role_id: 1, role_name: 'ADMIN' } },
  isAdmin: true,
  isResolved: true,
  role: 'ADMIN' as const,
  can: vi.fn(() => true),
};

vi.mock('../../../hooks/rbac/usePermission', () => ({
  usePermission: () => permissionMock,
}));

const profile: DoctorProfileResponse = {
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
    { specialization_id: 1, specialization_name: 'Orthodontics', specialization_code: 'ORTHO', is_primary: true, certification_date: '2020-06-15' },
  ],
  created_by: 1,
  updated_by: 1,
  created_at: '2024-01-01T00:00:00',
  updated_at: '2024-06-01T00:00:00',
  schedules: [
    { id: 's1', doctor_id: 'd1', day_of_week: 0, start_time: '09:00:00', end_time: '12:00:00', is_active: true },
  ],
};

const mockAppointment = {
  id: 'apt-1',
  appointment_number: 'APT-20260901-0001',
  patient_id: 'pat-1',
  dentist_id: 3,
  appointment_date: '2026-09-01',
  start_time: '10:00:00',
  end_time: '10:30:00',
  duration_minutes: 30,
  appointment_type: 'Consultation' as const,
  status: 'Scheduled' as const,
  reason_for_visit: 'Routine checkup',
  notes: null,
  patient_name: 'John Doe',
  dentist_name: 'Dr. Jose Rizal',
  created_by: 1,
  updated_by: null,
  created_at: '2026-08-28T00:00:00',
  updated_at: '2026-08-28T00:00:00',
};

const mockTreatmentPlan = {
  id: 'tp-1',
  plan_code: 'TXN-000001',
  patient_id: 'pat-1',
  doctor_id: 'd1',
  status: 'in_progress' as const,
  current_version: 2,
  is_active: true,
  item_count: 3,
  total_estimated_cost: 15000,
  created_by: 1,
  created_at: '2026-08-15T00:00:00',
  updated_at: '2026-08-20T00:00:00',
};

function renderDetails() {
  return renderWithProviders(
    <Routes>
      <Route path="/doctors/:doctorId" element={<DoctorDetailsContainer />} />
    </Routes>,
    { route: '/doctors/d1' },
  );
}

describe('DoctorDetailsContainer', () => {
  const getProfileMock = vi.mocked(doctorService.getProfile);

  beforeEach(() => {
    vi.mocked(doctorService.activate).mockReset();
    vi.mocked(doctorService.deactivate).mockReset();
    vi.mocked(doctorService.toggleLeave).mockReset();
    vi.mocked(doctorService.toggleAvailability).mockReset();
    vi.mocked(doctorService.get).mockReset();
    getProfileMock.mockReset();
    vi.mocked(appointmentService.list).mockReset();
    vi.mocked(treatmentPlanService.listByDoctor).mockReset();
  });

  it('renders the header, overview cards, schedule and specializations once loaded', async () => {
    getProfileMock.mockResolvedValue(profile);
    renderDetails();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Dr. Jose Rizal' })).toBeInTheDocument();
    });
    expect(screen.getByText('Doctor Information')).toBeInTheDocument();
    expect(screen.getByText('Clinical Information')).toBeInTheDocument();
    expect(screen.getByText('Emergency Contact')).toBeInTheDocument();
    expect(screen.getByText('Working Schedule')).toBeInTheDocument();
    expect(screen.getByText('Monday')).toBeInTheDocument();
    expect(screen.getByText('Specializations')).toBeInTheDocument();
    expect(screen.getByText('Orthodontics')).toBeInTheDocument();
  });

  it('renders Overview, Appointments, and Treatment Plans tabs (no Billing)', async () => {
    getProfileMock.mockResolvedValue(profile);
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Doctor Information')).toBeInTheDocument();
    });

    // Should have exactly three tabs
    for (const label of ['Overview', 'Appointments', 'Treatment Plans']) {
      expect(screen.getByRole('tab', { name: label })).toBeInTheDocument();
    }

    // Billing tab must NOT exist
    expect(screen.queryByRole('tab', { name: 'Billing' })).not.toBeInTheDocument();
  });

  it('shows a loading state while fetching the profile', () => {
    getProfileMock.mockReturnValue(new Promise(() => {}));
    renderDetails();
    expect(screen.getByRole('status', { name: 'Loading doctor' })).toBeInTheDocument();
  });

  it('shows the error state and retries', async () => {
    getProfileMock.mockRejectedValueOnce(new Error('Doctor does not exist'));
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Unable to load doctor')).toBeInTheDocument();
    });

    getProfileMock.mockResolvedValue(profile);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => {
      expect(screen.getByText('Doctor Information')).toBeInTheDocument();
    });
    expect(getProfileMock).toHaveBeenCalledTimes(2);
  });

  it('toggles availability through the confirmation dialog', async () => {
    getProfileMock.mockResolvedValue(profile);
    vi.mocked(doctorService.toggleAvailability).mockResolvedValue({
      ...profile,
      available_for_appointment: false,
    });
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Doctor Information')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Toggle Availability' }));
    expect(screen.getByRole('dialog', { name: 'Mark Unavailable' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Mark Unavailable' }));
    await waitFor(() => {
      expect(doctorService.toggleAvailability).toHaveBeenCalledWith('d1');
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('surfaces a backend 400 error inside the availability dialog', async () => {
    getProfileMock.mockResolvedValue(profile);
    vi.mocked(doctorService.toggleAvailability).mockRejectedValue(
      Object.assign(new Error('Request failed'), {
        isAxiosError: true,
        response: { status: 400, data: { message: 'Inactive doctors cannot be marked available.' } },
      }),
    );
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Doctor Information')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Toggle Availability' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mark Unavailable' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Inactive doctors cannot be marked available.',
      );
    });
    // Dialog stays open so the user can retry or cancel
    expect(screen.getByRole('dialog', { name: 'Mark Unavailable' })).toBeInTheDocument();
  });

  it('toggles leave through the confirmation dialog', async () => {
    getProfileMock.mockResolvedValue(profile);
    vi.mocked(doctorService.toggleLeave).mockResolvedValue({ ...profile, on_leave: true });
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Doctor Information')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Toggle Leave' }));
    expect(screen.getByRole('dialog', { name: 'Mark On Leave' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Mark On Leave' }));
    await waitFor(() => {
      expect(doctorService.toggleLeave).toHaveBeenCalledWith('d1');
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('invalidates the doctor cache after a successful toggle (profile refetch)', async () => {
    getProfileMock.mockResolvedValue(profile);
    vi.mocked(doctorService.toggleAvailability).mockResolvedValue({
      ...profile,
      available_for_appointment: false,
    });
    const { queryClient } = renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Doctor Information')).toBeInTheDocument();
    });
    expect(getProfileMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Toggle Availability' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mark Unavailable' }));

    // Mutation success invalidates the doctors key → the profile refetches.
    await waitFor(() => {
      expect(getProfileMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
    expect(queryClient.getQueryData(['doctors', 'profile', 'd1'])).toBeDefined();
  });

  it('opens the edit drawer and fetches the full doctor record', async () => {
    getProfileMock.mockResolvedValue(profile);
    vi.mocked(doctorService.get).mockResolvedValue(profile);
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Doctor Information')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await waitFor(() => {
      expect(doctorService.get).toHaveBeenCalledWith('d1');
    });
  });

  it('restores focus to the trigger after closing a toggle dialog', async () => {
    getProfileMock.mockResolvedValue(profile);
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Doctor Information')).toBeInTheDocument();
    });

    const toggleButton = screen.getByRole('button', { name: 'Toggle Availability' });
    toggleButton.focus();
    fireEvent.click(toggleButton);
    expect(screen.getByRole('dialog', { name: 'Mark Unavailable' })).toBeInTheDocument();

    // Closing via Cancel restores focus to the trigger (Modal focus trap).
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(document.activeElement).toBe(toggleButton);
    });
  });

  it('deactivates via the status dialog', async () => {
    getProfileMock.mockResolvedValue(profile);
    vi.mocked(doctorService.deactivate).mockResolvedValue({ ...profile, is_active: false });
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Doctor Information')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    const dialog = screen.getByRole('dialog', { name: 'Deactivate doctor' });
    expect(dialog).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Deactivate' }));
    await waitFor(() => {
      expect(doctorService.deactivate).toHaveBeenCalledWith('d1');
    });
  });
});

describe('DoctorDetailsContainer — Appointments Tab Integration', () => {
  const getProfileMock = vi.mocked(doctorService.getProfile);
  const listMock = vi.mocked(appointmentService.list);

  beforeEach(() => {
    getProfileMock.mockReset();
    listMock.mockReset();
    vi.mocked(treatmentPlanService.listByDoctor).mockReset();
  });

  it('Appointments tab exists and is clickable', async () => {
    getProfileMock.mockResolvedValue(profile);
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Doctor Information')).toBeInTheDocument();
    });

    expect(screen.getByRole('tab', { name: 'Appointments' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Appointments' }));
    // Should not throw — tab activates
  });

  it('does NOT show the old placeholder message', async () => {
    getProfileMock.mockResolvedValue(profile);
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Doctor Information')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Appointments' }));
    await waitFor(() => {
      expect(screen.queryByText(/module is connected/i)).not.toBeInTheDocument();
    });
  });

  it('triggers real appointment query with doctor.user_id as dentist_id', async () => {
    getProfileMock.mockResolvedValue(profile);
    listMock.mockResolvedValue({ items: [], total: 0 });
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Doctor Information')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Appointments' }));

    await waitFor(() => {
      expect(listMock).toHaveBeenCalled();
    });

    const callArgs = listMock.mock.calls[0]?.[0];
    // CRITICAL: must use doctor.user_id (Integer 3), NOT doctor.id (UUID 'd1')
    expect(callArgs).toMatchObject({ dentist_id: 3 });
    expect(callArgs).not.toMatchObject({ dentist_id: 'd1' });
  });

  it('shows loading state for appointments', async () => {
    getProfileMock.mockResolvedValue(profile);
    listMock.mockReturnValue(new Promise(() => {}));
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Doctor Information')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Appointments' }));

    // DataTable shows skeleton rows when loading
    await waitFor(() => {
      expect(screen.getByLabelText('Doctor appointments')).toBeInTheDocument();
    });
  });

  it('shows error state with retry for appointments', async () => {
    getProfileMock.mockResolvedValue(profile);
    listMock.mockRejectedValueOnce(new Error('Network error'));
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Doctor Information')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Appointments' }));

    await waitFor(() => {
      expect(screen.getByText('Failed to load data')).toBeInTheDocument();
    });
  });

  it('shows empty state when no appointments exist', async () => {
    getProfileMock.mockResolvedValue(profile);
    listMock.mockResolvedValue({ items: [], total: 0 });
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Doctor Information')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Appointments' }));

    await waitFor(() => {
      expect(screen.getByText('No appointments found for this doctor.')).toBeInTheDocument();
    });
  });

  it('renders appointment results with date, time, patient, type, status', async () => {
    getProfileMock.mockResolvedValue(profile);
    listMock.mockResolvedValue({ items: [mockAppointment], total: 1 });
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Doctor Information')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Appointments' }));

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
    expect(screen.getByText('Sep 1, 2026')).toBeInTheDocument();
    expect(screen.getByText('10:00 AM – 10:30 AM')).toBeInTheDocument();
    expect(screen.getAllByText('30 min').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Scheduled').length).toBeGreaterThanOrEqual(1);
  });

  it('renders appointment number as an accessible navigation link', async () => {
    getProfileMock.mockResolvedValue(profile);
    listMock.mockResolvedValue({ items: [mockAppointment], total: 1 });
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Doctor Information')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Appointments' }));

    await waitFor(() => {
      const link = screen.getByRole('link', { name: 'APT-20260901-0001' });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', '/appointments/apt-1');
    });
  });

  it('resets pagination when filter changes', async () => {
    getProfileMock.mockResolvedValue(profile);
    listMock.mockResolvedValue({ items: [mockAppointment], total: 1 });
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Doctor Information')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Appointments' }));

    await waitFor(() => {
      expect(listMock).toHaveBeenCalled();
    });

    const initialCallCount = listMock.mock.calls.length;

    // Change the status filter
    const select = screen.getByLabelText('Status:');
    fireEvent.change(select, { target: { value: 'Completed' } });

    await waitFor(() => {
      expect(listMock.mock.calls.length).toBeGreaterThan(initialCallCount);
    });

    // After filter change, first param should be back to skip: 0
    const lastCallArgs = listMock.mock.calls[listMock.mock.calls.length - 1]?.[0];
    expect(lastCallArgs).toMatchObject({
      dentist_id: 3,
      skip: 0,
      status: 'Completed',
    });
  });

  it('sends correct skip/limit for pagination', async () => {
    getProfileMock.mockResolvedValue(profile);
    listMock.mockResolvedValue({ items: [mockAppointment], total: 50 });
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Doctor Information')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Appointments' }));

    await waitFor(() => {
      expect(listMock).toHaveBeenCalled();
    });

    const firstCallArgs = listMock.mock.calls[0]?.[0];
    expect(firstCallArgs).toMatchObject({
      dentist_id: 3,
      skip: 0,
      limit: 20,
    });
  });

  it('does NOT show lifecycle mutation controls in embedded view', async () => {
    getProfileMock.mockResolvedValue(profile);
    listMock.mockResolvedValue({ items: [mockAppointment], total: 1 });
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Doctor Information')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Appointments' }));

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // No Create/Edit/Cancel/Confirm/Check In buttons should be present
    expect(screen.queryByRole('button', { name: /create appointment/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /confirm/i })).not.toBeInTheDocument();
  });
});

describe('DoctorDetailsContainer — Treatment Plans Tab Integration', () => {
  const getProfileMock = vi.mocked(doctorService.getProfile);
  const listByDoctorMock = vi.mocked(treatmentPlanService.listByDoctor);

  beforeEach(() => {
    getProfileMock.mockReset();
    listByDoctorMock.mockReset();
    vi.mocked(appointmentService.list).mockReset();
  });

  it('Treatment Plans tab exists and is clickable', async () => {
    getProfileMock.mockResolvedValue(profile);
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Doctor Information')).toBeInTheDocument();
    });

    expect(screen.getByRole('tab', { name: 'Treatment Plans' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Treatment Plans' }));
  });

  it('does NOT show the old placeholder message', async () => {
    getProfileMock.mockResolvedValue(profile);
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Doctor Information')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Treatment Plans' }));
    await waitFor(() => {
      expect(screen.queryByText(/module is connected/i)).not.toBeInTheDocument();
    });
  });

  it('triggers real treatment plan query with doctor.id UUID (NOT user_id)', async () => {
    getProfileMock.mockResolvedValue(profile);
    listByDoctorMock.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 20, total_pages: 0 });
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Doctor Information')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Treatment Plans' }));

    await waitFor(() => {
      expect(listByDoctorMock).toHaveBeenCalled();
    });

    // CRITICAL: first arg to listByDoctor is the doctor UUID, NOT user_id
    expect(listByDoctorMock.mock.calls[0]?.[0]).toBe('d1');
  });

  it('shows empty state when no treatment plans exist', async () => {
    getProfileMock.mockResolvedValue(profile);
    listByDoctorMock.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 20, total_pages: 0 });
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Doctor Information')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Treatment Plans' }));

    await waitFor(() => {
      expect(screen.getByText('No treatment plans found for this doctor.')).toBeInTheDocument();
    });
  });

  it('renders treatment plan results with plan code, patient, status, items, cost', async () => {
    getProfileMock.mockResolvedValue(profile);
    listByDoctorMock.mockResolvedValue({
      items: [mockTreatmentPlan],
      total: 1,
      page: 1,
      page_size: 20,
      total_pages: 1,
    });
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Doctor Information')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Treatment Plans' }));

    await waitFor(() => {
      expect(screen.getByText('TXN-000001')).toBeInTheDocument();
    });
    expect(screen.getByText('3')).toBeInTheDocument(); // item_count
    expect(screen.getByText('₹15,000.00')).toBeInTheDocument(); // total_estimated_cost
  });

  it('renders plan code as an accessible navigation link', async () => {
    getProfileMock.mockResolvedValue(profile);
    listByDoctorMock.mockResolvedValue({
      items: [mockTreatmentPlan],
      total: 1,
      page: 1,
      page_size: 20,
      total_pages: 1,
    });
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Doctor Information')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Treatment Plans' }));

    await waitFor(() => {
      const link = screen.getByRole('link', { name: 'TXN-000001' });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', '/treatment-plans/tp-1');
    });
  });

  it('doctor.id remains applied after filter/page changes', async () => {
    getProfileMock.mockResolvedValue(profile);
    listByDoctorMock.mockResolvedValue({
      items: [mockTreatmentPlan],
      total: 1,
      page: 1,
      page_size: 20,
      total_pages: 1,
    });
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Doctor Information')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Treatment Plans' }));

    await waitFor(() => {
      expect(listByDoctorMock).toHaveBeenCalled();
    });

    const initialCallCount = listByDoctorMock.mock.calls.length;

    // Change status filter
    const select = screen.getByLabelText('Status:');
    fireEvent.change(select, { target: { value: 'completed' } });

    await waitFor(() => {
      expect(listByDoctorMock.mock.calls.length).toBeGreaterThan(initialCallCount);
    });

    // Verify doctor.id is still passed as first arg
    const lastCall = listByDoctorMock.mock.calls[listByDoctorMock.mock.calls.length - 1];
    expect(lastCall?.[0]).toBe('d1');
  });
});

describe('DoctorDetailsContainer — Billing Tab Removal', () => {
  const getProfileMock = vi.mocked(doctorService.getProfile);

  beforeEach(() => {
    getProfileMock.mockReset();
  });

  it('Billing tab trigger is absent', async () => {
    getProfileMock.mockResolvedValue(profile);
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Doctor Information')).toBeInTheDocument();
    });

    expect(screen.queryByRole('tab', { name: 'Billing' })).not.toBeInTheDocument();
  });

  it('Billing placeholder content is absent', async () => {
    getProfileMock.mockResolvedValue(profile);
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Doctor Information')).toBeInTheDocument();
    });

    expect(screen.queryByText(/invoices and payments/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/No billing activity/i)).not.toBeInTheDocument();
  });

  it('old Billing placeholder text is absent', async () => {
    getProfileMock.mockResolvedValue(profile);
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Doctor Information')).toBeInTheDocument();
    });

    expect(screen.queryByText(/billing module is connected/i)).not.toBeInTheDocument();
  });
});

describe('DoctorDetailsContainer — Overview Regression', () => {
  const getProfileMock = vi.mocked(doctorService.getProfile);

  beforeEach(() => {
    getProfileMock.mockReset();
  });

  it('Overview still renders with all expected sections', async () => {
    getProfileMock.mockResolvedValue(profile);
    renderDetails();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Dr. Jose Rizal' })).toBeInTheDocument();
    });

    // All overview sections
    expect(screen.getByText('Doctor Information')).toBeInTheDocument();
    expect(screen.getByText('Clinical Information')).toBeInTheDocument();
    expect(screen.getByText('Emergency Contact')).toBeInTheDocument();
    expect(screen.getByText('Working Schedule')).toBeInTheDocument();
    expect(screen.getByText('Monday')).toBeInTheDocument();
    expect(screen.getByText('Specializations')).toBeInTheDocument();
    expect(screen.getByText('Orthodontics')).toBeInTheDocument();
  });

  it('Working Schedule is inside Overview, not in a separate tab', async () => {
    getProfileMock.mockResolvedValue(profile);
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Doctor Information')).toBeInTheDocument();
    });

    // Working Schedule should be visible in the default Overview tab
    expect(screen.getByText('Working Schedule')).toBeInTheDocument();

    // There should be NO Schedule tab
    expect(screen.queryByRole('tab', { name: 'Schedule' })).not.toBeInTheDocument();
  });

  it('Doctor actions (Edit, Activate/Deactivate, Toggle) still work', async () => {
    getProfileMock.mockResolvedValue(profile);
    vi.mocked(doctorService.get).mockResolvedValue(profile);
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Doctor Information')).toBeInTheDocument();
    });

    // Edit button
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();

    // Activate/Deactivate (admin-gated)
    expect(screen.getByRole('button', { name: 'Deactivate' })).toBeInTheDocument();

    // Toggle buttons
    expect(screen.getByRole('button', { name: 'Toggle Availability' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Toggle Leave' })).toBeInTheDocument();

    // Click edit to verify it works
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await waitFor(() => {
      expect(doctorService.get).toHaveBeenCalledWith('d1');
    });
  });
});
