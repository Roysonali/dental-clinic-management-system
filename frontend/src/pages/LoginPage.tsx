import type { FC } from 'react';
import AuthLayout from '../layouts/AuthLayout';
import { LoginHeader } from '../components/auth/shared/LoginHeader';
import { LoginForm } from '../components/auth/forms/LoginForm';
import { LoginFooter } from '../components/auth/shared/LoginFooter';

/**
 * Login page — the primary authentication entry point.
 *
 * Uses AuthLayout for the shared two-column layout.
 * The HeroSection, security notice, and responsive behavior
 * are managed by AuthLayout.
 *
 * @note No actual API integration. The LoginForm component accepts
 * an optional `onSubmit` callback that can be connected to the
 * authentication service in a future integration phase.
 */
const LoginPage: FC = () => {
  return (
    <AuthLayout sectionLabel="Sign in form">
      <LoginHeader />
      <LoginForm />
      <LoginFooter />
    </AuthLayout>
  );
};

export default LoginPage;
