import type { FC } from 'react';
import { DataTable, type DataTableColumn } from '../common/DataTable';
import { StatusBadge } from '../common/StatusBadge/StatusBadge';
import { Button } from '../common/Button/Button';
import { Tooltip } from '../common/Tooltip/Tooltip';
import { SectionHeader } from '../common/SectionHeader';
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_VARIANTS } from '../../constants/billing';
import { formatCurrency } from '../../utils/formatting';
import { formatISODate } from '../../utils/date';
import type { PaymentListItem } from '../../types/billing';

interface RecentPaymentsProps {
  /** Most recent payments from GET /billing/dashboard (up to 5). */
  payments: PaymentListItem[];
  /** Skeleton rows while the dashboard refetches. */
  loading?: boolean;
}

const VIEW_ALL_HINT_ID = 'recent-payments-view-all-hint';
const VIEW_ALL_HINT = 'Payment list arrives in the Payments phase';

/**
 * RecentPayments — dashboard "Recent Payments" section.
 *
 * Reuses the shared DataTable. "View all" is disabled until the Payment List
 * module (Phase 3) ships a route — no navigation to non-existent workflows.
 */
export const RecentPayments: FC<RecentPaymentsProps> = ({
  payments,
  loading = false,
}) => {
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
          {formatCurrency(pay.total_amount, pay.financials.currency_code)}
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
          <>
            <Tooltip content={VIEW_ALL_HINT}>
              <Button variant="ghost" size="sm" disabled aria-describedby={VIEW_ALL_HINT_ID}>
                View all
              </Button>
            </Tooltip>
            <span id={VIEW_ALL_HINT_ID} className="sr-only">
              {VIEW_ALL_HINT} — this view is not available yet.
            </span>
          </>
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
        />
      </div>
    </section>
  );
};
