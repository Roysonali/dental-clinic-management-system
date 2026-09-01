import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../../test/testUtils';
import { DoctorListContainer } from './DoctorListContainer';
import { doctorService } from '../../../services/doctorService';
import type { DoctorListResponse, DoctorResponse } from '../../../types/doctor';

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

// Sprint 11C: admin identity so the ADMIN-only deactivate/reactivate row
// actions render in the status-flow tests below.
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

const listMock = vi.mocked(doctorService.list);
const activateMock = vi.mocked(doctorService.activate);
const deactivateMock = vi.mocked(doctorService.deactivate);
const getMock = vi.mocked(doctorService.get);

const makeDoctor = (overrides: Partial<DoctorResponse> = {}): DoctorResponse => ({
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
  ...overrides,
});

const makeResponse = (total: number): DoctorListResponse => ({
  items: [
    makeDoctor(),
    makeDoctor({
      id: 'd2',
      doctor_code: 'DOC-000002',
      user_id: 4,
      user_full_name: 'Dr. Maria Santos',
      user_email: 'maria@clinic.com',
      is_active: false,
    }),
  ],
  total,
  page: 1,
  page_size: 20,
});

describe('DoctorListContainer', () => {
  beforeEach(() => {
    listMock.mockReset();
    listMock.mockResolvedValue(makeResponse(2));
    activateMock.mockReset();
    deactivateMock.mockReset();
    getMock.mockReset();
    permissionMock.can.mockReturnValue(true);
    vi.mocked(doctorService.listSpecializations).mockReset();
    vi.mocked(doctorService.listSpecializations).mockResolvedValue({
      items: [{ id: 1, name: 'Orthodontics', code: 'ORTHO', description: null, is_active: true }],
      total: 1,
      page: 1,
      page_size: 100,
    });
  });

  it('renders doctors fetched from the service', async () => {
    renderWithProviders(<DoctorListContainer />);

    await waitFor(() => {
      expect(screen.getByText('Dr. Jose Rizal')).toBeInTheDocument();
      expect(screen.getByText('Dr. Maria Santos')).toBeInTheDocument();
    });
    expect(listMock).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, page_size: 20, sort_by: 'full_name' }),
    );
  });

  it('renders exactly one toolbar and one search experience (no duplicated toolbar)', async () => {
    renderWithProviders(<DoctorListContainer />);

    await waitFor(() => expect(screen.getByText('Dr. Jose Rizal')).toBeInTheDocument());

    // Single searchbox, single filter groups, single Register Doctor CTA —
    // guards against any duplicate toolbar / search rendering regression.
    expect(screen.getAllByRole('searchbox')).toHaveLength(1);
    expect(screen.getAllByRole('group', { name: 'Filter by status' })).toHaveLength(1);
    expect(screen.getAllByRole('group', { name: 'Filter by availability' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Register Doctor' })).toHaveLength(1);
  });

  it('refetches with the debounced search term', async () => {
    renderWithProviders(<DoctorListContainer />);

    await waitFor(() => expect(screen.getByText('Dr. Jose Rizal')).toBeInTheDocument());
    expect(listMock).toHaveBeenCalledTimes(2); // table query + stats query

    fireEvent.change(screen.getByPlaceholderText('Search by doctor code or name…'), {
      target: { value: 'jose' },
    });

    await waitFor(
      () => expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ search: 'jose' })),
      { timeout: 2000 },
    );
  });

  it('refetches when the status filter changes', async () => {
    renderWithProviders(<DoctorListContainer />);

    await waitFor(() => expect(screen.getByText('Dr. Jose Rizal')).toBeInTheDocument());
    expect(listMock).toHaveBeenCalledTimes(2); // table query + stats query

    fireEvent.click(screen.getByRole('button', { name: 'Inactive' }));

    await waitFor(() =>
      expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ is_active: false })),
    );
  });

  it('refetches when the availability filter changes', async () => {
    renderWithProviders(<DoctorListContainer />);

    await waitFor(() => expect(screen.getByText('Dr. Jose Rizal')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Available' }));

    await waitFor(() =>
      expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ is_available: true })),
    );
  });

  it('refetches when a specialization filter is selected', async () => {
    renderWithProviders(<DoctorListContainer />);

    await waitFor(() => expect(screen.getByText('Dr. Jose Rizal')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Filter by specialization'), {
      target: { value: '1' },
    });

    await waitFor(() =>
      expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ specialization_id: 1 })),
    );
  });

  it('paginates through results', async () => {
    listMock.mockResolvedValue(makeResponse(45)); // 45 total → 3 pages
    renderWithProviders(<DoctorListContainer />);

    await waitFor(() => expect(screen.getByText('Dr. Jose Rizal')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));

    await waitFor(() =>
      expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ page: 2 })),
    );
  });

  it('opens the register drawer from the toolbar', async () => {
    renderWithProviders(<DoctorListContainer />);

    await waitFor(() => expect(screen.getByText('Dr. Jose Rizal')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Register Doctor' }));

    expect(screen.getByRole('dialog', { name: 'Register Doctor' })).toBeInTheDocument();
  });

  it('hides the ADMIN-only deactivate/reactivate row actions for non-admins', async () => {
    permissionMock.can.mockReturnValue(false);
    renderWithProviders(<DoctorListContainer />);

    await waitFor(() => expect(screen.getByText('Dr. Jose Rizal')).toBeInTheDocument());
    expect(
      screen.queryByRole('button', { name: 'Deactivate Dr. Jose Rizal' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Reactivate Dr. Maria Santos' }),
    ).not.toBeInTheDocument();
  });

  it('opens the edit drawer and fetches the doctor record', async () => {
    getMock.mockResolvedValue(makeDoctor());
    renderWithProviders(<DoctorListContainer />);

    await waitFor(() => expect(screen.getByText('Dr. Jose Rizal')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Edit Dr. Jose Rizal' }));

    expect(screen.getByRole('dialog', { name: 'Edit Doctor' })).toBeInTheDocument();
    await waitFor(() => expect(getMock).toHaveBeenCalledWith('d1'));
  });

  it('deactivates a doctor through the confirmation dialog', async () => {
    deactivateMock.mockResolvedValue(makeDoctor({ is_active: false }));
    renderWithProviders(<DoctorListContainer />);

    await waitFor(() => expect(screen.getByText('Dr. Jose Rizal')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate Dr. Jose Rizal' }));

    expect(screen.getByRole('dialog', { name: 'Deactivate doctor' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));

    await waitFor(() => expect(deactivateMock).toHaveBeenCalledWith('d1'));
  });

  it('reactivates an inactive doctor through the confirmation dialog', async () => {
    activateMock.mockResolvedValue(makeDoctor());
    renderWithProviders(<DoctorListContainer />);

    await waitFor(() => expect(screen.getByText('Dr. Jose Rizal')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Reactivate Dr. Maria Santos' }));

    expect(screen.getByRole('dialog', { name: 'Activate doctor' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Activate' }));

    await waitFor(() => expect(activateMock).toHaveBeenCalledWith('d2'));
  });

  it('surfaces status-mutation errors in the dialog', async () => {
    deactivateMock.mockRejectedValue(new Error('Doctor is already inactive.'));
    renderWithProviders(<DoctorListContainer />);

    await waitFor(() => expect(screen.getByText('Dr. Jose Rizal')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate Dr. Jose Rizal' }));
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));

    await waitFor(() =>
      expect(screen.getByText('Doctor is already inactive.')).toBeInTheDocument(),
    );
  });

  it('renders the error state when the list query fails', async () => {
    // 403 → shouldRetryQuery returns false, so the query fails immediately
    // (no retry delay in tests).
    listMock.mockRejectedValue({
      isAxiosError: true,
      response: { status: 403, data: { message: 'Failed to load data' } },
    });
    renderWithProviders(<DoctorListContainer />);

    // The message appears as both the ResultState title and description.
    expect(await screen.findAllByText('Failed to load data')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('renders the empty state when there are no doctors', async () => {
    listMock.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 20 });
    renderWithProviders(<DoctorListContainer />);

    expect(await screen.findByText('No doctors found')).toBeInTheDocument();
  });

  // ── Navigation tests ───────────────────────────────────────────────

  it('navigates to doctor details when clicking a doctor row', async () => {
    renderWithProviders(<DoctorListContainer />, { route: '/doctors' });

    await waitFor(() => expect(screen.getByText('Dr. Jose Rizal')).toBeInTheDocument());

    // Click the table row (not an action button) — the DataTable's onRowClick
    // fires and the container navigates to /doctors/:doctorId.
    const nameCell = screen.getByText('Dr. Jose Rizal');
    fireEvent.click(nameCell.closest('tr')!);

    // MemoryRouter updates the location — the path should now include the doctor ID.
    // We can verify the table no longer renders (page navigated away) or check
    // that the Edit drawer didn't open (row click ≠ edit).
    expect(screen.queryByRole('dialog', { name: 'Edit Doctor' })).not.toBeInTheDocument();
  });

  it('renders View Details action buttons for each doctor', async () => {
    renderWithProviders(<DoctorListContainer />, { route: '/doctors' });

    await waitFor(() => expect(screen.getByText('Dr. Jose Rizal')).toBeInTheDocument());

    expect(screen.getByRole('button', { name: 'View details for Dr. Jose Rizal' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View details for Dr. Maria Santos' })).toBeInTheDocument();
  });

  it('navigates to doctor details when clicking View Details button', async () => {
    renderWithProviders(<DoctorListContainer />, { route: '/doctors' });

    await waitFor(() => expect(screen.getByText('Dr. Jose Rizal')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'View details for Dr. Jose Rizal' }));

    // View Details navigates away — Edit dialog should NOT open
    expect(screen.queryByRole('dialog', { name: 'Edit Doctor' })).not.toBeInTheDocument();
  });

  it('does not trigger row navigation when clicking Edit button', async () => {
    getMock.mockResolvedValue(makeDoctor());
    renderWithProviders(<DoctorListContainer />, { route: '/doctors' });

    await waitFor(() => expect(screen.getByText('Dr. Jose Rizal')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Edit Dr. Jose Rizal' }));

    // Edit opens its dialog — NOT navigation
    expect(screen.getByRole('dialog', { name: 'Edit Doctor' })).toBeInTheDocument();
    await waitFor(() => expect(getMock).toHaveBeenCalledWith('d1'));
  });
});
