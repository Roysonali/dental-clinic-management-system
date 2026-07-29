import type { FC } from 'react';
import { Logo } from '../../common/Logo';
import { StatisticItem } from './StatisticItem';
import { SecurityNotice } from './SecurityNotice';

/**
 * Left panel of the authentication pages.
 * Features the DensCare branding, hero tagline, platform statistics,
 * and a security compliance notice.
 */
export const HeroSection: FC = () => {
  return (
    <aside
      className="relative flex w-full flex-col justify-between bg-neutral-900 px-8 py-10 lg:w-1/2 lg:px-12 lg:py-14"
      aria-label="DensCare platform overview"
    >
      {/* ── Top: Logo ─────────────────────────────────── */}
      <Logo variant="light" className="absolute top-10 left-8 lg:left-12" />

      {/* ── Center: Hero Content ──────────────────────── */}
      <div className="mt-20 flex flex-1 flex-col justify-center gap-8 lg:mt-0">
        {/* Hero Title */}
        <div className="space-y-4">
          <h2 className="text-display font-semibold leading-tight text-white">
            The clinical record,
            <br />
            the schedule
            <br />
            and the ledger —
            <br />
            <span className="text-primary-400">in one place.</span>
          </h2>

          {/* Supporting paragraph */}
          <p className="max-w-sm text-body leading-relaxed text-neutral-400">
            DensCare unifies patients, appointments, treatment plans and billing
            for multi-specialty dental clinics, with role-aware access for all
            seven clinic roles.
          </p>
        </div>

        {/* Statistics Row */}
        <div className="flex items-center gap-10 lg:gap-14">
          <StatisticItem value="9" label="Modules" />
          <div className="h-10 w-px bg-neutral-700" aria-hidden="true" />
          <StatisticItem value="115" label="API endpoints" />
          <div className="h-10 w-px bg-neutral-700" aria-hidden="true" />
          <StatisticItem value="7" label="Clinic roles" />
        </div>
      </div>

      {/* ── Bottom: Security Notice ───────────────────── */}
      <div className="mt-8 hidden lg:block">
        <SecurityNotice />
      </div>
    </aside>
  );
};
