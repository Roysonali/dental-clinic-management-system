import type { FC } from 'react';
import { Users, UserCheck, CalendarCheck, Coffee } from 'lucide-react';
import { StatCard } from '../common/StatCard/StatCard';
import { Icon } from '../common/Icon/Icon';

/* ── Types ─────────────────────────────────────────────────────────── */

export interface DoctorStats {
  total: number;
  active: number;
  available: number;
  onLeave: number;
}

interface DoctorStatsCardsProps {
  /** Derived counts shown in the KPI grid */
  stats: DoctorStats;
  /** Show skeleton placeholders while the list query resolves */
  loading?: boolean;
  /** Additional classes */
  className?: string;
}

/**
 * DoctorStatsCards — KPI grid summarizing the doctor roster.
 *
 * Pure presentation: counts are derived in DoctorListContainer from the
 * existing `GET /doctors` response (no new backend contract).
 */
export const DoctorStatsCards: FC<DoctorStatsCardsProps> = ({
  stats,
  loading = false,
  className = '',
}) => {
  return (
    <section
      aria-label="Doctor statistics"
      className={`grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4 ${className}`}
    >
      <StatCard
        icon={<Icon icon={Users} size="md" className="text-primary-500" />}
        title="Total Doctors"
        value={stats.total.toLocaleString()}
        subtitle="All registered doctors"
        loading={loading}
      />
      <StatCard
        icon={<Icon icon={UserCheck} size="md" className="text-primary-500" />}
        title="Active"
        value={stats.active.toLocaleString()}
        subtitle="Active practice"
        loading={loading}
      />
      <StatCard
        icon={<Icon icon={CalendarCheck} size="md" className="text-primary-500" />}
        title="Available"
        value={stats.available.toLocaleString()}
        subtitle="Accepting appointments"
        loading={loading}
      />
      <StatCard
        icon={<Icon icon={Coffee} size="md" className="text-primary-500" />}
        title="On Leave"
        value={stats.onLeave.toLocaleString()}
        subtitle="Currently out of clinic"
        loading={loading}
      />
    </section>
  );
};
