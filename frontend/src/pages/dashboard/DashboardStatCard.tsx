import type { FC, ReactNode } from 'react';
import { StatCard } from '../../components/common/StatCard/StatCard';

/**
 * DashboardStatCard — metric display card for the dashboard grid.
 *
 * Thin wrapper around the existing StatCard for consistent dashboard usage.
 *
 * @example
 * ```tsx
 * <DashboardStatCard
 *   icon={<Icon icon={Users} size="lg" className="text-primary-500" />}
 *   label="Total Patients"
 *   value="1,234"
 *   trend={{ value: "+12%", positive: true }}
 * />
 * ```
 */
interface DashboardStatCardProps {
  /** Icon element */
  icon: ReactNode;
  /** Metric label */
  label: string;
  /** Metric value */
  value: string;
  /** Optional trend indicator */
  trend?: { value: string; positive: boolean };
}

export const DashboardStatCard: FC<DashboardStatCardProps> = ({
  icon,
  label,
  value,
  trend,
}) => {
  return (
    <StatCard
      icon={icon}
      title={label}
      value={value}
      trend={trend}
      size="md"
    />
  );
};
