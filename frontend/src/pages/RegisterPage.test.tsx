import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import RegisterPage from './RegisterPage';

vi.mock('../services/authService', () => ({
  authService: {
    register: vi.fn(),
    registerDoctor: vi.fn(),
    login: vi.fn(),
    getMe: vi.fn(),
    fetchPendingUsers: vi.fn(),
    approveUser: vi.fn(),
    deactivateUser: vi.fn(),
  },
}));

import { authService } from '../services/authService';

const registerMock = vi.mocked(authService.register);
const registerDoctorMock = vi.mocked(authService.registerDoctor);

function renderRegisterPage() {
  return render(
    <MemoryRouter>
      <RegisterPage />
    </MemoryRouter>,
  );
}

/** Select "Staff" on the application-type chooser and complete the staff form. */
async function fillAndSubmitStaffForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Staff Receptionist/ }));

  await user.type(screen.getByLabelText(/^Full name/), 'Juan Dela Cruz');
  await user.type(screen.getByLabelText(/^Email address/), 'juan@example.com');
  await user.type(screen.getByLabelText(/^Password/), 'Secret@1');
  await user.type(screen.getByLabelText(/^Confirm password/), 'Secret@1');
  await user.click(screen.getByRole('checkbox'));
  await user.click(screen.getByRole('button', { name: 'Request access' }));
}

describe('RegisterPage', () => {
  beforeEach(() => {
    registerMock.mockReset();
    registerDoctorMock.mockReset();
  });

  it('shows the application-type chooser first (Staff vs Doctor)', async () => {
    renderRegisterPage();

    // Chooser step
    expect(screen.getByText('What are you applying as?')).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/^Full name/),
    ).not.toBeInTheDocument();

    // Both paths available
    expect(screen.getByText('Staff')).toBeInTheDocument();
    expect(screen.getByText('Doctor')).toBeInTheDocument();

    // No API call just from viewing
    expect(registerMock).not.toHaveBeenCalled();
    expect(registerDoctorMock).not.toHaveBeenCalled();
  });

  it('staff path: submits only the backend-registered fields and shows the success panel', async () => {
    registerMock.mockResolvedValue({
      message: 'Registration submitted. Waiting for admin approval.',
    });

    const user = userEvent.setup();
    renderRegisterPage();
    await fillAndSubmitStaffForm(user);

    await waitFor(() =>
      expect(registerMock).toHaveBeenCalledWith({
        full_name: 'Juan Dela Cruz',
        email: 'juan@example.com',
        password: 'Secret@1',
      }),
    );
    // Doctor endpoint must NOT be called on the staff path
    expect(registerDoctorMock).not.toHaveBeenCalled();

    expect(
      await screen.findByRole('heading', { name: 'Request submitted' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Registration submitted. Waiting for admin approval.',
    );
    expect(screen.queryByLabelText(/^Full name/)).not.toBeInTheDocument();
  });

  it('doctor path: Doctor fields appear only after choosing Doctor, and staff fields are gone', async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    // Choose Doctor
    await user.click(screen.getByRole('button', { name: /Doctor Dentist/ }));

    // Doctor wizard Step 1 renders
    expect(await screen.findByText('Account Information')).toBeInTheDocument();

    // Staff flow is gone: no staff-only submit button
    expect(
      screen.queryByRole('button', { name: 'Request access' }),
    ).not.toBeInTheDocument();

    // Wizard navigation present, final submit not yet available on Step 1
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Submit Application' }),
    ).not.toBeInTheDocument();
  });

  it('doctor path: registerDoctor is called only after full wizard + explicit Submit Application', async () => {
    registerDoctorMock.mockResolvedValue({
      message: 'Your doctor application has been submitted and is awaiting clinic approval.',
    });

    const user = userEvent.setup();
    renderRegisterPage();

    await user.click(screen.getByRole('button', { name: /Doctor Dentist/ }));
    await screen.findByText('Account Information');

    // Step 1: account fields
    await user.type(screen.getByLabelText(/^Full name/), 'Dr. Maria Santos');
    await user.type(screen.getByLabelText(/^Email address/), 'maria@denscare.clinic');
    await user.type(screen.getByLabelText(/^Password/), 'Secret@1');
    await user.type(screen.getByLabelText(/^Confirm password/), 'Secret@1');
    await user.click(screen.getByRole('checkbox'));

    // Continue through optional steps
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByText('Professional Details');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByText('Personal Details');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    // On review: still no API call
    expect(screen.getByText('Review Your Application')).toBeInTheDocument();
    expect(registerDoctorMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Submit Application' }));

    await waitFor(() => expect(registerDoctorMock).toHaveBeenCalledTimes(1));
    expect(registerDoctorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        full_name: 'Dr. Maria Santos',
        email: 'maria@denscare.clinic',
      }),
    );

    expect(
      await screen.findByRole('heading', { name: 'Request submitted' }),
    ).toBeInTheDocument();
    // Doctor-specific confirmation copy
    expect(
      screen.getByText('Your doctor application has been submitted.'),
    ).toBeInTheDocument();
  });

  it('surfaces backend errors (e.g. duplicate email) on the staff form', async () => {
    registerMock.mockRejectedValue(new Error('Email already registered'));

    const user = userEvent.setup();
    renderRegisterPage();
    await fillAndSubmitStaffForm(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Email already registered',
    );
    expect(
      screen.getByRole('heading', { name: 'Staff registration' }),
    ).toBeInTheDocument();
  });

  it('prevents staff submission until the password requirements are met', async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    await user.click(screen.getByRole('button', { name: /Staff Receptionist/ }));

    await user.type(screen.getByLabelText(/^Full name/), 'Juan Dela Cruz');
    await user.type(screen.getByLabelText(/^Email address/), 'juan@example.com');
    await user.type(screen.getByLabelText(/^Password/), 'short');
    await user.type(screen.getByLabelText(/^Confirm password/), 'short');
    await user.click(screen.getByRole('checkbox'));

    expect(screen.getByRole('button', { name: 'Request access' })).toBeDisabled();
  });

  it('no privileged role can be self-selected on any registration path', async () => {
    renderRegisterPage();

    // The chooser must not expose internal RBAC roles anywhere.
    const forbidden = ['Admin', 'Chief Doctor', 'General Doctor', 'Specialist Doctor', 'Consulting Doctor', 'Receptionist'];
    for (const role of forbidden) {
      expect(
        screen.queryByRole('button', { name: role }),
        `Public registration must not expose a "${role}" role option`,
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('combobox', { name: role }),
      ).not.toBeInTheDocument();
    }

    // The only choices are the two application intents.
    expect(screen.getByText('Staff')).toBeInTheDocument();
    expect(screen.getByText('Doctor')).toBeInTheDocument();
  });
});
