import type { FC } from 'react';
import {
  Users,
  CalendarCheck,
  DollarSign,
  FileText,
  UserPlus,
  CalendarPlus,
  Receipt,
  Calendar,
} from 'lucide-react';
import { Icon } from '../../components/common/Icon/Icon';
import { PageWrapper } from '../../layouts/components/PageWrapper';
import { ContentContainer } from '../../layouts/components/ContentContainer';
import { PageHeader } from '../../components/common/PageHeader/PageHeader';
import { Badge } from '../../components/common/Badge/Badge';
import { DashboardStatCard } from './DashboardStatCard';
import { SectionHeader } from './SectionHeader';
import { QuickActionCard } from './QuickActionCard';
import { ActivityItem } from './ActivityItem';
import { UpcomingAppointments } from '../../components/appointments/UpcomingAppointments';

/**
 * DashboardPage — authenticated landing page with placeholder metrics
 * and UI sections.
 *
 * All data is placeholder — no API calls, no business logic.
 *
 * Composes:
 * - Statistics grid (4 metric cards)
 * - Quick actions (4 action buttons)
 * - Recent activity (placeholder timeline)
 * - Upcoming appointments (placeholder list)
 */
export const DashboardPage: FC = () => {
  return (
    <ContentContainer width="wide">
      <PageWrapper>
        {/* ── Page Header ──────────────────────────── */}
        <PageHeader
          title="Dashboard"
          subtitle="Welcome back — here's what's happening today."
        />

        {/* ── Statistics Grid ───────────────────────── */}
        <section aria-labelledby="statistics-heading">
          <SectionHeader id="statistics-heading" title="Overview" />
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <DashboardStatCard
              icon={<Icon icon={Users} size="lg" className="text-primary-500" />}
              label="Total Patients"
              value="1,234"
              trend={{ value: "+12%", positive: true }}
            />
            <DashboardStatCard
              icon={<Icon icon={CalendarCheck} size="lg" className="text-success" />}
              label="Today's Appointments"
              value="18"
              trend={{ value: "+3", positive: true }}
            />
            <DashboardStatCard
              icon={<Icon icon={DollarSign} size="lg" className="text-emerald-500" />}
              label="Revenue Today"
              value="$4,250"
              trend={{ value: "+8%", positive: true }}
            />
            <DashboardStatCard
              icon={<Icon icon={FileText} size="lg" className="text-amber-500" />}
              label="Pending Treatments"
              value="42"
              trend={{ value: "-5%", positive: false }}
            />
          </div>
        </section>

        {/* ── Quick Actions ────────────────────────── */}
        <section aria-labelledby="quick-actions-heading">
          <SectionHeader id="quick-actions-heading" title="Quick Actions" />
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <QuickActionCard
              icon={<Icon icon={UserPlus} size="xl" className="text-primary-500" />}
              label="New Patient"
            />
            <QuickActionCard
              icon={<Icon icon={CalendarPlus} size="xl" className="text-success" />}
              label="Schedule Appointment"
            />
            <QuickActionCard
              icon={<Icon icon={Receipt} size="xl" className="text-amber-500" />}
              label="Create Invoice"
            />
            <QuickActionCard
              icon={<Icon icon={Calendar} size="xl" className="text-info" />}
              label="View Calendar"
            />
          </div>
        </section>

        {/* ── Recent Activity + Upcoming Appointments ── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Recent Activity */}
          <section aria-labelledby="activity-heading">
            <div className="rounded-xl border border-neutral-200 bg-white p-5">
              <SectionHeader id="activity-heading" title="Recent Activity" />
              <div className="mt-2 divide-y divide-neutral-100">
                <ActivityItem
                  icon={UserPlus}
                  iconColor="text-primary-500"
                  title="New patient registered"
                  description="Juan Dela Cruz"
                  timestamp="5 min ago"
                />
                <ActivityItem
                  icon={CalendarCheck}
                  iconColor="text-success"
                  title="Appointment completed"
                  description="Check-up — Dr. Santos"
                  timestamp="15 min ago"
                />
                <ActivityItem
                  icon={Receipt}
                  iconColor="text-amber-500"
                  title="Invoice paid"
                  description="INV-00123 — $150.00"
                  timestamp="1 hour ago"
                />
                <ActivityItem
                  icon={FileText}
                  iconColor="text-info"
                  title="Treatment plan updated"
                  description="Root canal — Patient #1089"
                  timestamp="2 hours ago"
                />
                <ActivityItem
                  icon={Users}
                  iconColor="text-neutral-500"
                  title="Patient record accessed"
                  description="Maria Santos — Dr. Cruz"
                  timestamp="3 hours ago"
                />
              </div>
            </div>
          </section>

          {/* Upcoming Appointments */}
          <section aria-labelledby="appointments-heading">
            <div className="rounded-xl border border-neutral-200 bg-white p-5">
              <SectionHeader
                id="appointments-heading"
                title="Upcoming Appointments"
                action={
                  <Badge variant="primary" size="sm">Today</Badge>
                }
              />
              <UpcomingAppointments />
            </div>
          </section>
        </div>
      </PageWrapper>
    </ContentContainer>
  );
};
