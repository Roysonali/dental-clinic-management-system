import { useState, type FC } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout';
import { RegisterForm } from '../components/auth/forms/RegisterForm';
import { Divider } from '../components/common/Divider';
import { Alert } from '../components/common/Alert/Alert';
import { authService } from '../services/authService';
import { ROUTES } from '../routes/routes';
import type { RegisterFormValues } from '../types/auth';

/**
 * Registration page — new clinic account request.
 *
 * Submits `{ full_name, email, password }` to POST /auth/register. The
 * backend creates the account with `pending` status — it can only log in
 * after an administrator approves it. On success the form is replaced by a
 * confirmation panel using the backend's message.
 *
 * Route: /auth/register
 */
const RegisterPage: FC = () => {
  const [registered, setRegistered] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (values: RegisterFormValues) => {
    // Only the backend-registered fields are sent — confirm_password and
    // terms_accepted are UI-only.
    const response = await authService.register({
      full_name: values.full_name,
      email: values.email,
      password: values.password,
    });

    setSuccessMessage(response.message);
    setRegistered(true);
  };

  if (registered) {
    return (
      <AuthLayout sectionLabel="Registration submitted">
        <div className="text-center sm:text-left">
          <h1 className="text-h2 font-semibold text-neutral-900">
            Request submitted
          </h1>
          <p className="mt-2 text-body text-neutral-500">
            Thank you for requesting clinic access.
          </p>
        </div>

        <Alert
          variant="success"
          title="Registration received"
          description={
            successMessage ||
            'Your account is pending administrator approval. You will be able to sign in once approved.'
          }
        />

        <div className="space-y-4">
          <p className="text-center text-body text-neutral-600">
            Once your account is approved, you can{' '}
            <Link
              to={ROUTES.AUTH.LOGIN}
              className="font-medium text-primary-600 hover:text-primary-700 transition-colors duration-150"
            >
              sign in
            </Link>{' '}
            to access the workspace.
          </p>

          <Divider />

          <p className="text-center">
            <Link
              to={ROUTES.AUTH.LOGIN}
              className="inline-flex items-center gap-1.5 text-caption text-neutral-500 hover:text-neutral-700 transition-colors duration-150"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M9.5 2.5L2.5 9.5M2.5 9.5H8M2.5 9.5V4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Back to sign in
            </Link>
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout sectionLabel="Create an account">
      {/* Registration Header */}
      <div className="text-center sm:text-left">
        <h1 className="text-h2 font-semibold text-neutral-900">
          Create an account
        </h1>
        <p className="mt-2 text-body text-neutral-500">
          Fill in your details to request clinic access.
        </p>
      </div>

      {/* Registration Form */}
      <RegisterForm onSubmit={handleSubmit} />

      {/* Bottom Links */}
      <div className="space-y-4">
        <p className="text-center text-body text-neutral-600">
          Already have an account?{' '}
          <Link
            to={ROUTES.AUTH.LOGIN}
            className="font-medium text-primary-600 hover:text-primary-700 transition-colors duration-150"
          >
            Sign in
          </Link>
        </p>

        <Divider />

        <p className="text-center">
          <Link
            to={ROUTES.AUTH.LOGIN}
            className="inline-flex items-center gap-1.5 text-caption text-neutral-500 hover:text-neutral-700 transition-colors duration-150"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M9.5 2.5L2.5 9.5M2.5 9.5H8M2.5 9.5V4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Back to sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
};

export default RegisterPage;
