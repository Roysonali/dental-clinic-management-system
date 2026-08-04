import type { FC } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from '../../layouts/AuthLayout';
import { Alert } from '../../components/common/Alert/Alert';
import { ROUTES } from '../../routes/routes';

/**
 * Forgot password page — informational only.
 *
 * The backend (`backend/app/modules/auth/routes.py`) exposes NO
 * forgot-password / reset-password endpoint, so a self-service reset flow
 * is intentionally NOT implemented here (no invented API calls). Users are
 * directed to contact their clinic administrator instead.
 *
 * Route: /auth/forgot-password
 */
const ForgotPasswordPage: FC = () => {
  return (
    <AuthLayout sectionLabel="Forgot password">
      <div className="text-center sm:text-left">
        <h1 className="text-h2 font-semibold text-neutral-900">
          Forgot your password?
        </h1>
        <p className="mt-2 text-body text-neutral-500">
          We're here to help you regain access to your account.
        </p>
      </div>

      <Alert
        variant="info"
        title="Password resets require administrator assistance"
        description="DensCare does not yet offer self-service password reset. Please contact your clinic administrator to have your password reset for you."
      />

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
