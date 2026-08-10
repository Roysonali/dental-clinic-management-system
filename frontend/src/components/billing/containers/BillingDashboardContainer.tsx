import { useState, type FC } from 'react';
import { useBillingDashboard } from '../../../hooks/billing/useBillingDashboard';
import { parseApiError } from '../../../services/apiError';
import { BillingKpiGrid } from '../BillingKpiGrid';
import { PatientFinancialSummary } from '../PatientFinancialSummary';
import { RecentInvoices } from '../RecentInvoices';
import { RecentPayments } from '../RecentPayments';
import { BillingDashboardEmptyState } from '../BillingDashboardEmptyState';
import { BillingDashboardLoading } from '../BillingDashboardLoading';
import { BillingDashboardError } from '../BillingDashboardError';
import { BillingDashboardPermission } from '../BillingDashboardPermission';

interface BillingDashboardContainerProps {
  /**
   * Requests the create-invoice drawer (owned by the page) — wired to the
   * empty state's "New invoice" CTA so it opens the drawer on the dashboard
   * directly instead of routing through the Invoice List page.
   */
  onRequestCreate?: () => void;
}

/**
 * BillingDashboardContainer — orchestration for the Billing Dashboard.
 *
 * One consolidated backend request (GET /billing/dashboard) drives every
 * section: totals, recent invoices, recent payments, and the optional
 * patient-level financial summary. The patient selector re-queries the same
 * endpoint with `patient_id` — no fabricated aggregation layer.
 *
 * States:
 * - Loading  → skeleton layout (no spinner, no layout jump)
 * - 403      → permission-denied state (never auto-retried)
 * - Error    → error banner + KPI grid degraded to "— / Unavailable"
 * - Empty    → zeroed KPI grid + centered empty state (no invoices/payments/
 *              credit notes — derived from the backend's own count totals)
 * - Populated→ KPI grid, patient summary, recent invoices & payments
 */
export const BillingDashboardContainer: FC<BillingDashboardContainerProps> = ({
  onRequestCreate = () => undefined,
}) => {
  // '' = system-wide dashboard (no patient filter).
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const dashboardQuery = useBillingDashboard(selectedPatientId || undefined);

  // 403 — authenticated but not permitted. Never retried (shouldRetryQuery),
  // so the permission state does not hammer the endpoint.
  if (dashboardQuery.isError) {
    const info = parseApiError(dashboardQuery.error);
    if (info.kind === 'forbidden') {
      return <BillingDashboardPermission />;
    }
  }

  if (dashboardQuery.isLoading) {
    return <BillingDashboardLoading />;
  }

  if (dashboardQuery.isError) {
    return (
      <div className="flex flex-col gap-6">
        <BillingDashboardError onRetry={() => void dashboardQuery.refetch()} />
        <BillingKpiGrid unavailable />
      </div>
    );
  }

  const data = dashboardQuery.data;
  if (!data) return <BillingDashboardLoading />;

  const isEmpty =
    data.totals.invoice_count === 0 &&
    data.totals.payment_count === 0 &&
    data.totals.credit_note_count === 0;

  return (
    <div className="flex flex-col gap-6">
      <BillingKpiGrid totals={data.totals} />

      {isEmpty ? (
        <BillingDashboardEmptyState onNewInvoice={onRequestCreate} />
      ) : (
        <>
          <PatientFinancialSummary
            patientId={selectedPatientId}
            onPatientChange={setSelectedPatientId}
            summary={data.patient_summary}
            loading={dashboardQuery.isFetching && selectedPatientId !== ''}
          />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <RecentInvoices
              invoices={data.recent_invoices}
              loading={dashboardQuery.isFetching && data.recent_invoices.length === 0}
            />
            <RecentPayments
              payments={data.recent_payments}
              loading={dashboardQuery.isFetching && data.recent_payments.length === 0}
            />
          </div>
        </>
      )}
    </div>
  );
};
