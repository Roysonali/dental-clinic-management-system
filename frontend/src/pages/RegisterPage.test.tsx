import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import RegisterPage from './RegisterPage';

vi.mock('../services/authService', () => ({
  authService: {
    register: vi.fn(),
    login: vi.fn(),
    getMe: vi.fn(),
    fetchPendingUsers: vi.fn(),
    approveUser: vi.fn(),
    deactivateUser: vi.fn(),
  },
}));

import { authService } from '../services/authService';

const registerMock = vi.mocked(authService.register);

function renderRegisterPage() {
  return render(
    <MemoryRouter>
      <RegisterPage />
    </MemoryRouter>,
  );
}

async function fillAndSubmit() {
  const user = userEvent.setup();
  // Labels render a required marker ("Full name *"), so use anchored regexes.
  await user.type(screen.getByLabelText(/^Full name/), 'Juan Dela Cruz');
  await user.type(screen.getByLabelText(/^Email address/), 'juan@example.com');
  await user.type(screen.getByLabelText(/^Password/), 'Secret@1');
  await user.type(screen.getByLabelText(/^Confirm password/), 'Secret@1');
  await user.click(screen.getByRole('checkbox'));
  await user.click(screen.getByRole('button', { name: 'Request access' }));
  return user;
}

describe('RegisterPage', () => {
  beforeEach(() => {
    registerMock.mockReset();
  });

  it('submits only the backend-registered fields and shows the success panel', async () => {
    registerMock.mockResolvedValue({
      message: 'Registration submitted. Waiting for admin approval.',
    });

    renderRegisterPage();
    await fillAndSubmit();

    await waitFor(() =>
      expect(registerMock).toHaveBeenCalledWith({
        full_name: 'Juan Dela Cruz',
        email: 'juan@example.com',
        password: 'Secret@1',
      }),
    );

    // Confirmation state replaces the form.
    expect(
      await screen.findByRole('heading', { name: 'Request submitted' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Registration submitted. Waiting for admin approval.',
    );
    expect(screen.queryByLabelText(/^Full name/)).not.toBeInTheDocument();
  });

  it('surfaces backend errors (e.g. duplicate email) on the form', async () => {
    registerMock.mockRejectedValue(new Error('Email already registered'));

    renderRegisterPage();
    await fillAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Email already registered',
    );
    // Form remains for correction.
    expect(screen.getByRole('heading', { name: 'Create an account' })).toBeInTheDocument();
  });

  it('prevents submission until the password requirements are met', async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByLabelText(/^Full name/), 'Juan Dela Cruz');
    await user.type(screen.getByLabelText(/^Email address/), 'juan@example.com');
    await user.type(screen.getByLabelText(/^Password/), 'short');
    await user.type(screen.getByLabelText(/^Confirm password/), 'short');
    await user.click(screen.getByRole('checkbox'));

    expect(screen.getByRole('button', { name: 'Request access' })).toBeDisabled();
  });
});
