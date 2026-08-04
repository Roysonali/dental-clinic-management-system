import type { FC } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout';
import { LoginHeader } from '../components/auth/shared/LoginHeader';
import { LoginForm } from '../components/auth/forms/LoginForm';
import { LoginFooter } from '../components/auth/shared/LoginFooter';
import { useAuth } from '../hooks/auth/useAuth';
import { ROUTES } from '../routes/routes';
import type { LoginFormValues } from '../types/auth';

/**
 * Login page — the primary authentication entry point.
 *
 * Uses AuthLayout for the shared two-column layout. Submitting the form
 * signs the user in via `useAuth().login`, then redirects to the page
 * they originally tried to reach (or the dashboard).
 */
const LoginPage: FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Preserve the intended destination set by ProtectedRoute so users are
  // returned where they were headed after signing in.
  const from =
    (location.state as { from?: { pathname?: string } } | null)?.from
      ?.pathname ?? ROUTES.DASHBOARD;

  const handleSubmit = async (values: LoginFormValues) => {
    await login(values.email, values.password, values.remember_me ?? false);
    navigate(from, { replace: true });
  };

  return (
    <AuthLayout sectionLabel="Sign in form">
      <LoginHeader />
      <LoginForm onSubmit={handleSubmit} />
      <LoginFooter />
    </AuthLayout>
  );
};

export default LoginPage;
