import type { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataTable, type DataTableColumn } from '../common/DataTable';
import { StatusBadge } from '../common/StatusBadge/StatusBadge';
import { Button } from '../common/Button/Button';
import { SectionHeader } from '../common/SectionHeader';
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_VARIANTS, PAYMENT_CURRENCY_CODE } from '../../constants/billing';
import { formatCurrency } from '../../utils/formatting';
import { formatISODate } from '../../utils/date';
import { ROUTES } from '../../routes/routes';
import type { PaymentListItem } from '../../types/billing';

interface RecentPaymentsProps {
  /** Most recent payments from GET /billing/dashboard (up to 5). */
  payments: PaymentListItem[];
  /** Skeleton rows while the dashboard refetches. */
  loading?: boolean;
}

/**
 * RecentPayments — dashboard "Recent Payments" section.
 *
 * Reuses the shared DataTable. "View all" and row clicks navigate to the
 * Payment List / Detail routes now that Phase 3 (Sprint 14A.3) ships them.
 *
 * Amounts present in INR (`PAYMENT_CURRENCY_CODE`) — the same presentation
 * currency as the Payments module, so a payment reads identically here and
 * on the Payments pages. The backend's derived payment `currency_code` is
 * ignored for display (presentation decision; amounts themselves are the
 * backend's).
 */
export const RecentPayments: FC<RecentPaymentsProps> = ({
  payments,
  loading = false,
}) => {
  const navigate = useNavigate();

  const columns: DataTableColumn<PaymentListItem>[] = [
    {
      key: 'payment',
      header: 'Payment',
      render: (pay) => (
        <div className="min-w-0">
          <p className="font-mono text-label font-medium text-neutral-900">{pay.payment_number}</p>
          <p className="mt-0.5 text-caption text-neutral-400">
            {PAYMENT_METHOD_LABELS[pay.payment_method]} · {formatISODate(pay.payment_date)}
          </p>
        </div>
      ),
    },
    {
      key: 'patient',
      header: 'Patient',
      render: (pay) => (
        <div className="min-w-0">
          <p className="truncate text-body font-medium text-neutral-900">{pay.patient.full_name}</p>
          <p className="mt-0.5 text-caption text-neutral-400">{pay.patient.patient_code}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (pay) => (
        <StatusBadge status={pay.status} statusMap={PAYMENT_STATUS_VARIANTS} size="sm" />
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (pay) => (
        <span className="font-medium text-neutral-900 tabular-nums">
          {formatCurrency(pay.total_amount, PAYMENT_CURRENCY_CODE)}
        </span>
      ),
    },
  ];

  return (
    <section aria-labelledby="recent-payments-heading">
      <SectionHeader
        id="recent-payments-heading"
        title="Recent Payments"
        action={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(ROUTES.BILLING_PAYMENTS)}
          >
            View all
          </Button>
        }
      />
      <div className="mt-4">
        <DataTable
          columns={columns}
          data={payments}
          rowKey={(pay) => pay.id}
          loading={loading}
          loadingRows={5}
          ariaLabel="Recent payments"
          emptyTitle="No payments yet"
          emptyDescription="Payments appear here once they are recorded."
          onRowClick={(pay) => navigate(`${ROUTES.BILLING_PAYMENTS}/${pay.id}`)}
        />
      </div>
    </section>
  );
};
