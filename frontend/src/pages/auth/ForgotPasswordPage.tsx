import { useState, type FC } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../../layouts/AuthLayout';
import { Alert } from '../../components/common/Alert/Alert';
import { Button } from '../../components/common/Button';
import { ForgotPasswordForm } from '../../components/auth/forms/ForgotPasswordForm';
import { authService } from '../../services/authService';
import { ROUTES } from '../../routes/routes';
import type { ForgotPasswordFormValues } from '../../types/auth';

/**
 * Forgot password page — self-service password-recovery request.
 *
 * Submits `{ email }` to POST /auth/forgot-password (public). The backend
 * returns the SAME generic message whether or not the account exists, so
 * this page shows one generic success state and never reveals account
 * existence.
 *
 * Route: /auth/forgot-password
 */
const ForgotPasswordPage: FC = () => {
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (values: ForgotPasswordFormValues) => {
    // Surface the backend's generic message (it never reveals whether the
    // account exists).
    const response = await authService.forgotPassword(values.email);
    setSuccessMessage(response.message);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <AuthLayout sectionLabel="Reset link sent">
        <div className="text-center sm:text-left">
          <h1 className="text-h2 font-semibold text-neutral-900">
            Check your email
          </h1>
          <p className="mt-2 text-body text-neutral-500">
            We've taken care of your request.
          </p>
        </div>

        <Alert
          variant="success"
          title="Reset link sent"
          description={
            successMessage ||
            "If an account exists for this email address, we've sent password reset instructions. Please check your inbox (and spam folder) and follow the link — it expires shortly."
          }
        />

        <div className="space-y-4">
          <Button
            type="button"
            size="lg"
            fullWidth
            onClick={() => navigate(ROUTES.AUTH.LOGIN)}
          >
            Back to sign in
          </Button>

          <p className="text-center text-body text-neutral-600">
            Didn't receive an email?{' '}
            <Link
              to={ROUTES.AUTH.FORGOT_PASSWORD}
              className="font-medium text-primary-600 hover:text-primary-700 transition-colors duration-150"
              onClick={() => setSubmitted(false)}
            >
              Try again with another address
            </Link>
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout sectionLabel="Forgot password">
      <div className="text-center sm:text-left">
        <h1 className="text-h2 font-semibold text-neutral-900">
          Forgot your password?
        </h1>
        <p className="mt-2 text-body text-neutral-500">
          Enter the email address you registered with and we'll send you
          instructions to reset your password.
        </p>
      </div>

      <ForgotPasswordForm onSubmit={handleSubmit} />

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

export default ForgotPasswordPage;
