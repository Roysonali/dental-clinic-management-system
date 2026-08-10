import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ResetPasswordPage from './ResetPasswordPage';
import { ROUTES } from '../../routes/routes';

vi.mock('../../services/authService', () => ({
  authService: {
    resetPassword: vi.fn(),
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

const resetPasswordMock = vi.mocked(authService.resetPassword);

const VALID_TOKEN = 's3cr3t-token-value-1234567890';
const NEW_PASSWORD = 'NewSecure@Pass1';

/** Axios-shaped 400 (backend rejects the token). */
function axiosError(status: number, message: string): Error {
  return Object.assign(new Error(message), {
    isAxiosError: true,
    response: { status, data: { message } },
  });
}

function renderPage(token: string | null = VALID_TOKEN) {
  const initialEntries = token
    ? [`/auth/reset-password?token=${token}`]
    : ['/auth/reset-password'];
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <ResetPasswordPage />
    </MemoryRouter>,
  );
}

async function fillAndSubmit() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/^New password/), NEW_PASSWORD);
  await user.type(screen.getByLabelText(/^Confirm new password/), NEW_PASSWORD);
  await user.click(screen.getByRole('button', { name: 'Reset Password' }));
  return user;
}

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    resetPasswordMock.mockReset();
  });

  describe('missing / invalid token', () => {
    it('shows the invalid-link state when no token is present', () => {
      renderPage(null);

      expect(
        screen.getByText('This password reset link is invalid or has expired'),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Request a new reset link' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: 'Sign in' }),
      ).toHaveAttribute('href', ROUTES.AUTH.LOGIN);
      // Never renders the form without a token.
      expect(screen.queryByLabelText(/^New password/)).not.toBeInTheDocument();
    });

    it('switches to the invalid-link state when the backend rejects the token (400)', async () => {
      resetPasswordMock.mockRejectedValue(
        axiosError(400, 'This password reset link is invalid or has expired.'),
      );

      renderPage();
      await fillAndSubmit();

      expect(
        await screen.findByText(
          'This password reset link is invalid or has expired',
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Request a new reset link' }),
      ).toBeInTheDocument();
    });
  });

  describe('form rendering and validation', () => {
    it('renders the form with two password fields when a token is present', () => {
      renderPage();

      expect(
        screen.getByRole('heading', { name: 'Set a new password' }),
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/^New password/)).toBeInTheDocument();
      expect(
        screen.getByLabelText(/^Confirm new password/),
      ).toBeInTheDocument();
    });

    it('blocks weak passwords (shared password policy)', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.type(screen.getByLabelText(/^New password/), 'weak');
      await user.type(screen.getByLabelText(/^Confirm new password/), 'weak');
      // onTouched mode validates on blur — tab away from the field first.
      await user.tab();

      expect(
        screen.getByText('Password must be at least 8 characters'),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Reset Password' }),
      ).toBeDisabled();
    });

    it('rejects a confirmation mismatch', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.type(screen.getByLabelText(/^New password/), NEW_PASSWORD);
      await user.type(
        screen.getByLabelText(/^Confirm new password/),
        'Different@Pass1',
      );
      // onTouched mode validates on blur — tab away from the confirm field.
      await user.tab();

      expect(
        await screen.findByText('Passwords do not match'),
      ).toBeInTheDocument();
      expect(resetPasswordMock).not.toHaveBeenCalled();
    });
  });

  describe('submission', () => {
    it('submits the token and new password and shows the success state', async () => {
      resetPasswordMock.mockResolvedValue({
        message: 'Your password has been reset successfully.',
      });

      renderPage();
      await fillAndSubmit();

      await waitFor(() =>
        expect(resetPasswordMock).toHaveBeenCalledWith(
          VALID_TOKEN,
          NEW_PASSWORD,
        ),
      );

      expect(
        await screen.findByText('Your password has been reset successfully'),
      ).toBeInTheDocument();
      // Requires a fresh sign-in — never auto-logs the user in.
      expect(
        screen.getByRole('button', { name: 'Sign in' }),
      ).toBeInTheDocument();
      expect(screen.queryByLabelText(/^New password/)).not.toBeInTheDocument();
    });

    it('surfaces non-token API failures on the form and keeps the form', async () => {
      resetPasswordMock.mockRejectedValue(
        axiosError(500, 'Something went wrong on the server.'),
      );

      renderPage();
      await fillAndSubmit();

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Something went wrong on the server.',
      );
      // Form remains — the link itself was never rejected.
      expect(screen.getByLabelText(/^New password/)).toBeInTheDocument();
    });

    it('shows a loading state while resetting', async () => {
      let resolveRequest: (value: { message: string }) => void;
      resetPasswordMock.mockReturnValue(
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
      );

      renderPage();
      await fillAndSubmit();

      expect(
        screen.getByRole('button', { name: 'Resetting...' }),
      ).toBeInTheDocument();

      resolveRequest!({ message: 'Your password has been reset successfully.' });
      expect(
        await screen.findByText('Your password has been reset successfully'),
      ).toBeInTheDocument();
    });
  });
});
