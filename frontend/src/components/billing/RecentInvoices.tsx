import type { FC } from 'react';
import { DataTable, type DataTableColumn } from '../common/DataTable';
import { StatusBadge } from '../common/StatusBadge/StatusBadge';
import { Button } from '../common/Button/Button';
import { Tooltip } from '../common/Tooltip/Tooltip';
import { SectionHeader } from '../common/SectionHeader';
import { INVOICE_STATUS_VARIANTS } from '../../constants/billing';
import { formatCurrency } from '../../utils/formatting';
import { formatISODate } from '../../utils/date';
import type { InvoiceListItem } from '../../types/billing';

interface RecentInvoicesProps {
  /** Most recent invoices from GET /billing/dashboard (up to 5). */
  invoices: InvoiceListItem[];
  /** Skeleton rows while the dashboard refetches. */
  loading?: boolean;
}

const VIEW_ALL_HINT_ID = 'recent-invoices-view-all-hint';
const VIEW_ALL_HINT = 'Invoice list arrives in the Invoices phase';

/**
 * RecentInvoices — dashboard "Recent Invoices" section.
 *
 * Reuses the shared DataTable (no new table architecture). "View all" is
 * disabled until the Invoice List module (Phase 2) ships a route — the button
 * must not navigate to a non-existent workflow.
 */
export const RecentInvoices: FC<RecentInvoicesProps> = ({
  invoices,
  loading = false,
}) => {
  const columns: DataTableColumn<InvoiceListItem>[] = [
    {
      key: 'invoice',
      header: 'Invoice',
      render: (inv) => (
        <div className="min-w-0">
          <p className="font-mono text-label font-medium text-neutral-900">{inv.invoice_number}</p>
          <p className="mt-0.5 text-caption text-neutral-400">{formatISODate(inv.invoice_date)}</p>
        </div>
      ),
    },
    {
      key: 'patient',
      header: 'Patient',
      render: (inv) => (
        <div className="min-w-0">
          <p className="truncate text-body font-medium text-neutral-900">{inv.patient.full_name}</p>
          <p className="mt-0.5 text-caption text-neutral-400">{inv.patient.patient_code}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (inv) => (
        <StatusBadge status={inv.status} statusMap={INVOICE_STATUS_VARIANTS} size="sm" />
      ),
    },
    {
      key: 'grand-total',
      header: 'Grand Total',
      align: 'right',
      render: (inv) => (
        <span className="font-medium text-neutral-900 tabular-nums">
          {formatCurrency(inv.financials.grand_total, inv.financials.currency_code)}
        </span>
      ),
    },
  ];

  return (
    <section aria-labelledby="recent-invoices-heading">
      <SectionHeader
        id="recent-invoices-heading"
        title="Recent Invoices"
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
          data={invoices}
          rowKey={(inv) => inv.id}
          loading={loading}
          loadingRows={5}
          ariaLabel="Recent invoices"
          emptyTitle="No invoices yet"
          emptyDescription="Invoices appear here once they are created."
        />
      </div>
    </section>
  );
};
