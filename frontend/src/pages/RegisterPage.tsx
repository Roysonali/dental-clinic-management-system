import type { FC } from 'react';
import { Link } from 'react-router-dom';
import { HeroSection } from '../components/auth/HeroSection';
import { RegisterForm } from '../components/auth/RegisterForm';
import { Divider } from '../components/common/Divider';
import { SecurityNotice } from '../components/auth/SecurityNotice';

/**
 * Registration page — new clinic account request.
 *
 * Features a responsive two-column layout (same as login):
 * - Left: Branding hero section (dark navy)
 * - Right: Registration form (white)
 *
 * On success, redirects to login with a success banner message.
 * No actual API integration yet — the form's onSubmit callback
 * is ready for future auth service connection.
 *
 * Route: /auth/register
 */
const RegisterPage: FC = () => {
  return (
    <main className="flex min-h-screen flex-col lg:flex-row">
      {/* ── Left Panel: Hero Section ───────────────────── */}
      <HeroSection />

      {/* ── Right Panel: Registration Form ──────────────── */}
      <section
        className="flex w-full items-center justify-center bg-white px-6 py-10 lg:w-1/2 lg:px-12"
        aria-label="Create an account"
      >
        <div className="flex w-full max-w-[420px] flex-col gap-8">
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
          <RegisterForm />

          {/* Bottom Links */}
          <div className="space-y-4">
            <p className="text-center text-body text-neutral-600">
              Already have an account?{' '}
              <Link
                to="/auth/login"
                className="font-medium text-primary-600 hover:text-primary-700 transition-colors duration-150"
              >
                Sign in
              </Link>
            </p>

            <Divider />

            <p className="text-center">
              <Link
                to="/auth/login"
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

          {/* Security Notice (mobile only) */}
          <div className="lg:hidden">
            <SecurityNotice />
          </div>
        </div>
      </section>
    </main>
  );
};

export default RegisterPage;
