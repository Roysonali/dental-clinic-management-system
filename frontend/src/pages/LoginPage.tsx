import type { FC } from 'react';
import { HeroSection } from '../components/auth/HeroSection';
import { LoginHeader } from '../components/auth/LoginHeader';
import { LoginForm } from '../components/auth/LoginForm';
import { LoginFooter } from '../components/auth/LoginFooter';
import { SecurityNotice } from '../components/auth/SecurityNotice';

/**
 * Login page — the primary authentication entry point.
 *
 * Features a responsive two-column layout:
 * - Left: Branding hero section (dark navy)
 * - Right: Login form (white)
 *
 * On mobile, stacks vertically: hero on top, form below.
 *
 * @note No actual API integration. The LoginForm component accepts
 * an optional `onSubmit` callback that can be connected to the
 * authentication service in a future integration phase.
 */
const LoginPage: FC = () => {
  return (
    <main className="flex min-h-screen flex-col lg:flex-row">
      {/* ── Left Panel: Hero Section ───────────────────── */}
      <HeroSection />

      {/* ── Right Panel: Login Form ─────────────────────── */}
      <section
        className="flex w-full items-center justify-center bg-white px-6 py-10 lg:w-1/2 lg:px-12"
        aria-label="Sign in form"
      >
        <div className="flex w-full max-w-[420px] flex-col gap-8">
          {/* Login Header */}
          <LoginHeader />

          {/* Login Form */}
          <LoginForm />

          {/* Login Footer */}
          <LoginFooter />

          {/* Security Notice (mobile only) */}
          <div className="lg:hidden">
            <SecurityNotice />
          </div>
        </div>
      </section>
    </main>
  );
};

export default LoginPage;
