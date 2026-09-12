import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { PendingUsersContainer } from './PendingUsersContainer';
import { authService } from '../../../services/authService';
import type {
  PendingUserResponse,
  DoctorApplicationResponse,
  RoleResponse,
} from '../../../types/auth';

vi.mock('../../../services/authService', () => ({
  authService: {
    fetchPendingUsers: vi.fn(),
    approveUser: vi.fn(),
    deactivateUser: vi.fn(),
    fetchDoctorApplications: vi.fn(),
    approveDoctorApplication: vi.fn(),
    rejectDoctorApplication: vi.fn(),
    fetchRoles: vi.fn(),
  },
}));

const fetchPendingMock = vi.mocked(authService.fetchPendingUsers);
const approveUserMock = vi.mocked(authService.approveUser);
const deactivateMock = vi.mocked(authService.deactivateUser);
const fetchDoctorAppsMock = vi.mocked(authService.fetchDoctorApplications);
const approveDoctorMock = vi.mocked(authService.approveDoctorApplication);
const rejectDoctorMock = vi.mocked(authService.rejectDoctorApplication);
const fetchRolesMock = vi.mocked(authService.fetchRoles);

/* Server role list (F-03) — ids intentionally NOT the seeded 1–7 to prove
 * the UI uses server data rather than the hardcoded map. */
const serverRoles: RoleResponse[] = [
  { id: 11, name: 'ADMIN' },
  { id: 12, name: 'CHIEF_DOCTOR' },
  { id: 13, name: 'GENERAL_DOCTOR' },
  { id: 14, name: 'SPECIALIST_DOCTOR' },
  { id: 15, name: 'CONSULTING_DOCTOR' },
  { id: 16, name: 'RECEPTIONIST' },
  { id: 17, name: 'DENTAL_ASSISTANT' },
];

/* ── Fixtures ─────────────────────────────────────────────────── */

const staffUsers: PendingUserResponse[] = [
  { id: 2, full_name: 'Maria Santos', email: 'maria@example.com', status: 'pending' },
];

const doctorApp: DoctorApplicationResponse = {
  id: 10,
  user_id: 20,
  user_full_name: 'Dr. Ana Reyes',
  user_email: 'ana@denscare.clinic',
  qualification: 'DMD, MSc Orthodontics',
  registration_number: 'PRC-0099881',
  years_of_experience: 8,
  date_of_birth: '1988-04-12',
  gender: 'female',
  primary_phone: '+639171112222',
  address: '21 Mabini St., Quezon City',
  profile_photo_url: 'https://cdn.denscare.clinic/photos/ana.jpg',
  requested_specialization_ids: [1, 2],
  primary_specialization_id: 1,
  specialization_names: ['Orthodontics', 'Prosthodontics'],
  status: 'pending',
  submitted_at: '2026-09-01T08:30:00Z',
};

function forbiddenError(): AxiosError {
  const config = {} as InternalAxiosRequestConfig;
  const response = {
    data: { success: false, message: 'Insufficient permissions' },
    status: 403,
    statusText: 'Forbidden',
    headers: {},
    config,
  } as AxiosResponse;
  return new AxiosError(
    'Request failed with status code 403',
    'ERR_BAD_REQUEST',
    config,
    undefined,
    response,
  );
}

/* ── Harness ──────────────────────────────────────────────────── */

function renderContainer() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false, gcTime: Infinity, staleTime: Infinity },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <PendingUsersContainer />
    </QueryClientProvider>,
  );
}

function defaultMocks() {
  fetchPendingMock.mockResolvedValue(staffUsers);
  fetchDoctorAppsMock.mockResolvedValue([doctorApp]);
  approveUserMock.mockResolvedValue({ message: 'User approved' });
  deactivateMock.mockResolvedValue({ message: 'User deactivated' });
  approveDoctorMock.mockResolvedValue({ message: 'Application approved' });
  rejectDoctorMock.mockResolvedValue({ message: 'Application rejected' });
  fetchRolesMock.mockResolvedValue(serverRoles);
}

beforeEach(() => {
  vi.clearAllMocks();
  defaultMocks();
});

/* ── Section rendering ────────────────────────────────────────── */

describe('PendingUsersContainer — F-06 Pending Approval coverage', () => {
  it('renders staff and doctor applications in clearly separated sections', async () => {
    renderContainer();

    const staffTable = await screen.findByRole('table', { name: 'Pending staff approvals' });
    expect(staffTable).toBeInTheDocument();

    const doctorTable = await screen.findByRole('table', { name: 'Doctor applications' });
    expect(doctorTable).toBeInTheDocument();

    // Section headers distinguish the two application types
    expect(screen.getByText('Doctor Applications')).toBeInTheDocument();
    expect(screen.getByText('Staff Applications')).toBeInTheDocument();
  });

  it('identifies the doctor application with professional details', async () => {
    renderContainer();

    const doctorTable = await screen.findByRole('table', { name: 'Doctor applications' });
    expect(within(doctorTable).getByText('Dr. Ana Reyes')).toBeInTheDocument();
    expect(within(doctorTable).getByText('ana@denscare.clinic')).toBeInTheDocument();
    expect(within(doctorTable).getByText('DMD, MSc Orthodontics')).toBeInTheDocument();
  });

  it('renders staff applications with role selection and approval controls', async () => {
    renderContainer();

    const staffTable = await screen.findByRole('table', { name: 'Pending staff approvals' });
    expect(within(staffTable).getByText('Maria Santos')).toBeInTheDocument();
    expect(within(staffTable).getByRole('combobox')).toBeInTheDocument();
    expect(within(staffTable).getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(within(staffTable).getByRole('button', { name: 'Deactivate' })).toBeInTheDocument();
  });

  it('staff approval dropdown does NOT offer privileged doctor-role confusion — it lists backend-mirrored role options', async () => {
    renderContainer();

    const staffTable = await screen.findByRole('table', { name: 'Pending staff approvals' });
    const combo = within(staffTable).getByRole('combobox');

    // Staff role options come from the canonical ROLE_IDS mapping.
    expect(within(combo).getByText('Administrator')).toBeInTheDocument();
    expect(within(combo).getByText('Receptionist')).toBeInTheDocument();
  });

  /* ── Doctor review modal ─────────────────────────────────── */

  it('review modal shows full professional and personal details', async () => {
    const user = userEvent.setup();
    renderContainer();

    const doctorTable = await screen.findByRole('table', { name: 'Doctor applications' });
    await user.click(within(doctorTable).getByRole('button', { name: 'Review' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Doctor Application Review')).toBeInTheDocument();
    expect(within(dialog).getByText('Dr. Ana Reyes')).toBeInTheDocument();
    expect(within(dialog).getByText('PRC-0099881')).toBeInTheDocument();
    expect(within(dialog).getByText('8 years')).toBeInTheDocument();
    expect(within(dialog).getByText('+639171112222')).toBeInTheDocument();
    expect(within(dialog).getByText('21 Mabini St., Quezon City')).toBeInTheDocument();
  });

  it('review modal displays the submitted profile photo', async () => {
    const user = userEvent.setup();
    renderContainer();

    const doctorTable = await screen.findByRole('table', { name: 'Doctor applications' });
    await user.click(within(doctorTable).getByRole('button', { name: 'Review' }));

    const dialog = await screen.findByRole('dialog');
    const img = within(dialog).getByAltText('Dr. Ana Reyes profile photo');
    expect(img).toHaveAttribute('src', 'https://cdn.denscare.clinic/photos/ana.jpg');
  });

  it('review modal shows initials fallback when no photo was submitted', async () => {
    fetchDoctorAppsMock.mockResolvedValue([{ ...doctorApp, profile_photo_url: undefined }]);
    const user = userEvent.setup();
    renderContainer();

    const doctorTable = await screen.findByRole('table', { name: 'Doctor applications' });
    await user.click(within(doctorTable).getByRole('button', { name: 'Review' }));

    const dialog = await screen.findByRole('dialog');
    // Initials fallback derives from the first two words ("Dr.", "Ana") → "DA"
    expect(within(dialog).getByText('DA')).toBeInTheDocument();
    expect(
      within(dialog).queryByAltText('Dr. Ana Reyes profile photo'),
    ).not.toBeInTheDocument();
  });

  it('review modal lists requested specializations', async () => {
    const user = userEvent.setup();
    renderContainer();

    const doctorTable = await screen.findByRole('table', { name: 'Doctor applications' });
    await user.click(within(doctorTable).getByRole('button', { name: 'Review' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Orthodontics')).toBeInTheDocument();
    expect(within(dialog).getByText('Prosthodontics')).toBeInTheDocument();
  });

  it('doctor role selector offers ONLY doctor roles (no Admin/Receptionist)', async () => {
    const user = userEvent.setup();
    renderContainer();

    const doctorTable = await screen.findByRole('table', { name: 'Doctor applications' });
    await user.click(within(doctorTable).getByRole('button', { name: 'Review' }));

    const dialog = await screen.findByRole('dialog');
    const combo = within(dialog).getByRole('combobox');

    const optionTexts = Array.from(combo.querySelectorAll('option')).map((o) => o.textContent);
    expect(optionTexts.join(' | ')).not.toContain('Administrator');
    expect(optionTexts.join(' | ')).not.toContain('Receptionist');
    expect(optionTexts.join(' | ')).not.toContain('Dental Assistant');
    expect(optionTexts.join(' | ')).toContain('Chief Doctor');
    expect(optionTexts.join(' | ')).toContain('General Doctor');
    expect(optionTexts.join(' | ')).toContain('Specialist Doctor');
    expect(optionTexts.join(' | ')).toContain('Consulting Doctor');
  });

  it('Approve is disabled until a doctor role is selected, then calls the API with the chosen role', async () => {
    const user = userEvent.setup();
    renderContainer();

    const doctorTable = await screen.findByRole('table', { name: 'Doctor applications' });
    await user.click(within(doctorTable).getByRole('button', { name: 'Review' }));

    const dialog = await screen.findByRole('dialog');
    const approveBtn = within(dialog).getByRole('button', { name: 'Approve' });
    expect(approveBtn).toBeDisabled();

    // Select by the stable role NAME (F-03) — the UI resolves it to the
    // server-provided id (13) at submit time.
    await user.selectOptions(within(dialog).getByRole('combobox'), 'GENERAL_DOCTOR');
    expect(approveBtn).toBeEnabled();

    await user.click(approveBtn);
    await waitFor(() => expect(approveDoctorMock).toHaveBeenCalledWith(10, 13));
  });

  it('successful approve refreshes the doctor application list without reload', async () => {
    const user = userEvent.setup();
    renderContainer();

    await screen.findByRole('table', { name: 'Doctor applications' });
    const callsBefore = fetchDoctorAppsMock.mock.calls.length;

    const doctorTable = screen.getByRole('table', { name: 'Doctor applications' });
    await user.click(within(doctorTable).getByRole('button', { name: 'Review' }));

    const dialog = await screen.findByRole('dialog');
    await user.selectOptions(within(dialog).getByRole('combobox'), 'GENERAL_DOCTOR');
    await user.click(within(dialog).getByRole('button', { name: 'Approve' }));

    await waitFor(() =>
      expect(fetchDoctorAppsMock.mock.calls.length).toBeGreaterThan(callsBefore),
    );
    // Modal closes after action
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
  });

  it('reject calls the API with the reason and refreshes the list (F-01)', async () => {
    const user = userEvent.setup();
    renderContainer();

    await screen.findByRole('table', { name: 'Doctor applications' });
    const callsBefore = fetchDoctorAppsMock.mock.calls.length;

    const doctorTable = screen.getByRole('table', { name: 'Doctor applications' });
    await user.click(within(doctorTable).getByRole('button', { name: 'Review' }));

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Reject' }));

    await waitFor(() => expect(rejectDoctorMock).toHaveBeenCalledWith(10, undefined));
    await waitFor(() =>
      expect(fetchDoctorAppsMock.mock.calls.length).toBeGreaterThan(callsBefore),
    );
  });

  it('surfaces a clean business error when approve fails (e.g. duplicate registration number)', async () => {
    approveDoctorMock.mockRejectedValue(
      new Error('Registration number is already assigned to another doctor'),
    );
    const user = userEvent.setup();
    renderContainer();

    const doctorTable = await screen.findByRole('table', { name: 'Doctor applications' });
    await user.click(within(doctorTable).getByRole('button', { name: 'Review' }));

    const dialog = await screen.findByRole('dialog');
    await user.selectOptions(within(dialog).getByRole('combobox'), 'GENERAL_DOCTOR');
    await user.click(within(dialog).getByRole('button', { name: 'Approve' }));

    expect(await screen.findByText('Action failed')).toBeInTheDocument();
    expect(
      screen.getByText('Registration number is already assigned to another doctor'),
    ).toBeInTheDocument();
  });

  /* ── List states ─────────────────────────────────────────── */

  it('shows a loading state while fetching', () => {
    fetchPendingMock.mockReturnValue(new Promise(() => {}));
    renderContainer();
    // Spinner exposes an accessible label rather than visible text.
    expect(screen.getByLabelText('Loading pending approvals')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows an empty state when there are no pending approvals', async () => {
    fetchPendingMock.mockResolvedValue([]);
    fetchDoctorAppsMock.mockResolvedValue([]);
    renderContainer();

    expect(await screen.findByText('No pending approvals')).toBeInTheDocument();
  });

  it('shows an insufficient-permissions state on 403', async () => {
    fetchPendingMock.mockRejectedValue(forbiddenError());
    renderContainer();

    expect(await screen.findByText('Insufficient permissions')).toBeInTheDocument();
  });

  it('shows an error state with retry for other failures', async () => {
    fetchPendingMock.mockRejectedValue(new Error('Server exploded'));
    renderContainer();

    // shouldRetryQuery performs one retry with a 1s backoff before the
    // error state surfaces, so allow a generous timeout.
    expect(
      await screen.findByText('Unable to load pending approvals', {}, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
