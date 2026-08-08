import type { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataTable, type DataTableColumn } from '../common/DataTable';
import { StatusBadge } from '../common/StatusBadge/StatusBadge';
import { Button } from '../common/Button/Button';
import { SectionHeader } from '../common/SectionHeader';
import { INVOICE_STATUS_VARIANTS } from '../../constants/billing';
import { formatCurrency } from '../../utils/formatting';
import { formatISODate } from '../../utils/date';
import { ROUTES } from '../../routes/routes';
import type { InvoiceListItem } from '../../types/billing';

interface RecentInvoicesProps {
  /** Most recent invoices from GET /billing/dashboard (up to 5). */
  invoices: InvoiceListItem[];
  /** Skeleton rows while the dashboard refetches. */
  loading?: boolean;
}

/**
 * RecentInvoices — dashboard "Recent Invoices" section.
 *
 * Reuses the shared DataTable (no new table architecture). "View all" and row
 * clicks navigate to the Invoice List / Detail routes now that Phase 2
 * (Sprint 14A.2) ships them.
 */
export const RecentInvoices: FC<RecentInvoicesProps> = ({
  invoices,
  loading = false,
}) => {
  const navigate = useNavigate();

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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(ROUTES.BILLING_INVOICES)}
          >
            View all
          </Button>
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
          onRowClick={(inv) => navigate(`${ROUTES.BILLING_INVOICES}/${inv.id}`)}
        />
      </div>
    </section>
  );
};
