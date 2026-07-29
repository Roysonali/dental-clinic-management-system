import type { FC, ReactNode } from 'react';
import { HeroSection } from '../components/auth/layout/HeroSection';
import { SecurityNotice } from '../components/auth/layout/SecurityNotice';

/**
 * AuthLayout — shared two-column authentication layout.
 *
 * - Left (desktop): HeroSection with branding, stats, and security notice.
 * - Right (desktop): Children content panel (login/register form etc.).
 * - Mobile: Stacks vertically — hero on top, content below.
 *
 * @example
 * ```tsx
 * <AuthLayout>
 *   <LoginForm />
 * </AuthLayout>
 * ```
 */
interface AuthLayoutProps {
  /** Page content rendered in the right panel */
  children: ReactNode;
  /** ARIA label for the right panel section */
  sectionLabel?: string;
}

const AuthLayout: FC<AuthLayoutProps> = ({
  children,
  sectionLabel = 'Authentication form',
}) => {
  return (
    <main className="flex min-h-screen flex-col lg:flex-row">
      {/* ── Left Panel: Hero Section ───────────────────── */}
      <HeroSection />

      {/* ── Right Panel: Content ────────────────────────── */}
      <section
        className="flex w-full items-center justify-center bg-white px-6 py-10 lg:w-1/2 lg:px-12"
        aria-label={sectionLabel}
      >
        <div className="flex w-full max-w-[420px] flex-col gap-8">
          {children}

          {/* Security Notice (mobile only) */}
          <div className="lg:hidden">
            <SecurityNotice />
          </div>
        </div>
      </section>
    </main>
  );
};

export default AuthLayout;
