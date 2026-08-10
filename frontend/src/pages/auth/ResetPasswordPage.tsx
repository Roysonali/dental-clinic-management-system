import { useState, type FC } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthLayout from '../../layouts/AuthLayout';
import { Alert } from '../../components/common/Alert/Alert';
import { Button } from '../../components/common/Button';
import { ResetPasswordForm } from '../../components/auth/forms/ResetPasswordForm';
import { authService } from '../../services/authService';
import { parseApiError } from '../../services/apiError';
import { ROUTES } from '../../routes/routes';
import type { ResetPasswordFormValues } from '../../types/auth';

/**
 * Reset password page — completes the self-service password recovery flow.
 *
 * The secure token arrives in the query string (`?token=...`) from the
 * reset email. The token itself is never rendered or logged client-side.
 *
 * States:
 * - No token in the URL → invalid-link panel (link is unusable).
 * - Token present → New Password / Confirm form.
 * - Backend rejects the token (400: invalid/expired/used/revoked) →
 *   invalid-link panel with a path to request a fresh link.
 * - Success → confirmation panel; the user signs in with the new password
 *   (no automatic login).
 *
 * Route: /auth/reset-password?token=<token>
 */
const ResetPasswordPage: FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [resetComplete, setResetComplete] = useState(false);
  const [tokenInvalid, setTokenInvalid] = useState(false);

  const handleSubmit = async (values: ResetPasswordFormValues) => {
    if (!token) {
      setTokenInvalid(true);
      return;
    }

    try {
      await authService.resetPassword(token, values.new_password);
      setResetComplete(true);
    } catch (error) {
      // The backend's only 400 on this endpoint means the token is
      // invalid / expired / used / revoked → show the invalid-link state.
      // Everything else (network, 5xx) is rethrown for the form banner.
      if (parseApiError(error).status === 400) {
        setTokenInvalid(true);
        return;
      }
      throw error;
    }
  };

  // ── Invalid / expired link state ────────────────────────────────────
  if (tokenInvalid || !token) {
    return (
      <AuthLayout sectionLabel="Invalid reset link">
        <div className="text-center sm:text-left">
          <h1 className="text-h2 font-semibold text-neutral-900">
            Reset link unavailable
          </h1>
          <p className="mt-2 text-body text-neutral-500">
            We couldn't process this password reset request.
          </p>
        </div>

        <Alert
          variant="danger"
          title="This password reset link is invalid or has expired"
          description="Please request a new reset link and try again within the time limit."
        />

        <div className="space-y-4">
          <Button
            type="button"
            size="lg"
            fullWidth
            onClick={() => navigate(ROUTES.AUTH.FORGOT_PASSWORD)}
          >
            Request a new reset link
          </Button>

          <p className="text-center text-body text-neutral-600">
            Remembered your password?{' '}
            <Link
              to={ROUTES.AUTH.LOGIN}
              className="font-medium text-primary-600 hover:text-primary-700 transition-colors duration-150"
            >
              Sign in
            </Link>
          </p>
        </div>
      </AuthLayout>
    );
  }

  // ── Success state — require a fresh sign-in with the new password ────
  if (resetComplete) {
    return (
      <AuthLayout sectionLabel="Password reset complete">
        <div className="text-center sm:text-left">
          <h1 className="text-h2 font-semibold text-neutral-900">
            Password reset complete
          </h1>
          <p className="mt-2 text-body text-neutral-500">
            Your account is ready to use again.
          </p>
        </div>

        <Alert
          variant="success"
          title="Your password has been reset successfully"
          description="You can now sign in with your new password."
        />

        <Button
          type="button"
          size="lg"
          fullWidth
          onClick={() => navigate(ROUTES.AUTH.LOGIN)}
        >
          Sign in
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout sectionLabel="Reset password">
      <div className="text-center sm:text-left">
        <h1 className="text-h2 font-semibold text-neutral-900">
          Set a new password
        </h1>
        <p className="mt-2 text-body text-neutral-500">
          Choose a strong password you haven't used for this account before.
        </p>
      </div>

      <ResetPasswordForm onSubmit={handleSubmit} />

      <div>
        <Link
          to={ROUTES.AUTH.LOGIN}
          className="inline-flex items-center gap-1.5 text-body font-medium text-primary-600 hover:text-primary-700 transition-colors duration-150"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M10 3L5 8L10 13"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back to sign in
        </Link>
      </div>
    </AuthLayout>
  );
};

export default ResetPasswordPage;
