import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ForgotPasswordPage from './ForgotPasswordPage';
import { ROUTES } from '../../routes/routes';

vi.mock('../../services/authService', () => ({
  authService: {
    forgotPassword: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    getMe: vi.fn(),
    fetchPendingUsers: vi.fn(),
    approveUser: vi.fn(),
    deactivateUser: vi.fn(),
  },
}));

import { authService } from '../../services/authService';

const forgotPasswordMock = vi.mocked(authService.forgotPassword);

const GENERIC_MESSAGE =
  'If an account exists for this email address, we\'ve sent password reset instructions.';

function renderPage() {
  return render(
    <MemoryRouter>
      <ForgotPasswordPage />
    </MemoryRouter>,
  );
}

async function fillAndSubmit(email = 'user@example.com') {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/^Email address/), email);
  await user.click(screen.getByRole('button', { name: 'Send Reset Link' }));
  return user;
}

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    forgotPasswordMock.mockReset();
  });

  it('renders the page heading, subtitle and email field', () => {
    renderPage();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Forgot your password?' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/enter the email address you registered with/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^Email address/)).toBeInTheDocument();
  });

  it('requires a valid email address before submitting', async () => {
    const user = userEvent.setup();
    renderPage();

    // Empty submission is blocked (button disabled until valid).
    expect(
      screen.getByRole('button', { name: 'Send Reset Link' }),
    ).toBeDisabled();

    await user.type(screen.getByLabelText(/^Email address/), 'not-an-email');
    // onTouched mode validates on blur — tab away from the field first.
    await user.tab();
    expect(
      screen.getByText('Please enter a valid email address'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Send Reset Link' }),
    ).toBeDisabled();
  });

  it('submits the email and shows the generic success state', async () => {
    forgotPasswordMock.mockResolvedValue({ message: GENERIC_MESSAGE });

    renderPage();
    await fillAndSubmit();

    await waitFor(() =>
      expect(forgotPasswordMock).toHaveBeenCalledWith('user@example.com'),
    );

    // Generic success — never claims the account exists.
    expect(
      await screen.findByRole('heading', { name: 'Check your email' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(GENERIC_MESSAGE);
    expect(screen.queryByLabelText(/^Email address/)).not.toBeInTheDocument();
  });

  it('shows a loading state while submitting', async () => {
    let resolveRequest: (value: { message: string }) => void;
    forgotPasswordMock.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );

    renderPage();
    await fillAndSubmit();

    expect(
      screen.getByRole('button', { name: 'Sending...' }),
    ).toBeInTheDocument();

    resolveRequest!({ message: GENERIC_MESSAGE });
    expect(
      await screen.findByRole('heading', { name: 'Check your email' }),
    ).toBeInTheDocument();
  });

  it('surfaces API failures on the form and keeps the form available', async () => {
    forgotPasswordMock.mockRejectedValue(new Error('Unable to reach the server.'));

    renderPage();
    await fillAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to reach the server.',
    );
    // Form remains so the user can retry.
    expect(screen.getByLabelText(/^Email address/)).toBeInTheDocument();
  });

  it('links back to the login page', () => {
    renderPage();

    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute(
      'href',
      ROUTES.AUTH.LOGIN,
    );
  });
});
