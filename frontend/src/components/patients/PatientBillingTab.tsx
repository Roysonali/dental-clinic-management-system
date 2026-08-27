import { useMemo, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, DollarSign } from 'lucide-react';
import { DataTable } from '../common/DataTable/DataTable';
import { Button } from '../common/Button/Button';
import { Icon } from '../common/Icon/Icon';
import { Badge } from '../common/Badge/Badge';
import { useInvoices } from '../../hooks/billing/useInvoices';
import { useBillingDashboard } from '../../hooks/billing/useBillingDashboard';
import { formatISODate } from '../../utils/date';
import { formatCurrency } from '../../utils/formatting';
import { ROUTES } from '../../routes/routes';
import { apiErrorMessage } from '../../services/apiError';
import { PAYMENT_CURRENCY_CODE } from '../../constants/billing';
import type { CreateActionType } from './PatientQuickActions';
import type { InvoiceListItem } from '../../types/billing';

interface PatientBillingTabProps {
  patientId: string;
  /** Callback to open the contextual create drawer. When provided, the empty-state CTA
   *  uses this instead of navigating away from Patient Hub. */
  onCreateAction?: (action: CreateActionType) => void;
}

const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  issued: 'Issued',
  partially_paid: 'Partially Paid',
  paid: 'Paid',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
  void: 'Void',
};

/**
 * PatientBillingTab — renders billing summary + paginated invoices
 * for a specific patient.
 *
 * Data source:
 * - GET /billing/dashboard?patient_id=X (financial summary)
 * - GET /billing/invoices?patient_id=X (invoice list)
 *
 * Business logic is NOT duplicated — all financial calculations come
 * from the backend billing module.
 */
export const PatientBillingTab: FC<PatientBillingTabProps> = ({ patientId, onCreateAction }) => {
  const navigate = useNavigate();

  const invoicesQuery = useInvoices({
    patient_id: patientId,
    page: 1,
    page_size: 20,
    sort_by: 'invoice_date',
    sort_order: 'desc',
  });

  const dashboardQuery = useBillingDashboard(patientId);

  const items = useMemo(
    () => invoicesQuery.data?.items ?? [],
    [invoicesQuery.data?.items],
  );

  const patientSummary = useMemo(
    () => dashboardQuery.data?.patient_summary ?? null,
    [dashboardQuery.data?.patient_summary],
  );

  const queryError = invoicesQuery.error
    ? apiErrorMessage(invoicesQuery.error)
    : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Financial Summary Card */}
      {patientSummary && (
        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <Icon icon={DollarSign} size="md" className="text-primary-500" />
            <h3 className="text-h4 font-semibold text-neutral-900">
              Financial Summary
            </h3>
          </div>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <dt className="text-body-sm text-neutral-500">Invoiced</dt>
              <dd className="text-body font-semibold text-neutral-900 tabular-nums">
                {formatCurrency(patientSummary.total_invoiced, PAYMENT_CURRENCY_CODE)}
              </dd>
            </div>
            <div>
              <dt className="text-body-sm text-neutral-500">Collected</dt>
              <dd className="text-body font-semibold text-green-600 tabular-nums">
                {formatCurrency(patientSummary.total_paid, PAYMENT_CURRENCY_CODE)}
              </dd>
            </div>
            <div>
              <dt className="text-body-sm text-neutral-500">Outstanding</dt>
              <dd className="text-body font-semibold text-amber-600 tabular-nums">
                {formatCurrency(patientSummary.total_outstanding, PAYMENT_CURRENCY_CODE)}
              </dd>
            </div>
            <div>
              <dt className="text-body-sm text-neutral-500">Credited</dt>
              <dd className="text-body font-semibold text-neutral-600 tabular-nums">
                {formatCurrency(patientSummary.total_credited, PAYMENT_CURRENCY_CODE)}
              </dd>
            </div>
          </dl>
        </div>
      )}

      {/* Invoices Table */}
      <div className="rounded-xl border border-neutral-200 bg-white">
        <DataTable<InvoiceListItem>
          ariaLabel="Patient invoices"
          data={items}
          rowKey={(invoice) => invoice.id}
          loading={invoicesQuery.isLoading}
          error={queryError}
          onRetry={() => void invoicesQuery.refetch()}
          onRowClick={(invoice) =>
            navigate(`${ROUTES.BILLING_INVOICES}/${invoice.id}`)
          }
          emptyTitle="No invoices"
          emptyDescription="Invoices for this patient will appear here once created."
        emptyAction={
          <Button
            size="md"
            onClick={() =>
              onCreateAction
                ? onCreateAction('invoice')
                : navigate(`${ROUTES.BILLING_INVOICES}?create=true&patientId=${patientId}`)
            }
            leftIcon={<Icon icon={Plus} size="md" />}
            className="shrink-0 whitespace-nowrap"
          >
            New Invoice
          </Button>
        }
          columns={[
            {
              key: 'invoice_number',
              header: 'Invoice #',
              accessor: 'invoice_number',
              sortable: true,
              render: (row) => (
                <span className="font-mono text-caption text-neutral-600">
                  {row.invoice_number}
                </span>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              accessor: 'status',
              sortable: true,
              render: (row) => (
                <Badge variant="secondary" size="sm">
                  {INVOICE_STATUS_LABELS[row.status] ?? row.status}
                </Badge>
              ),
            },
            {
              key: 'grand_total',
              header: 'Total',
              sortable: true,
              align: 'right',
              cellClassName: 'tabular-nums',
              sortValue: (row) => row.financials.grand_total,
              render: (row) =>
                formatCurrency(row.financials.grand_total, row.financials.currency_code),
            },
            {
              key: 'outstanding_amount',
              header: 'Outstanding',
              sortable: true,
              align: 'right',
              cellClassName: 'tabular-nums',
              sortValue: (row) => row.financials.outstanding_amount,
              render: (row) =>
                formatCurrency(row.financials.outstanding_amount, row.financials.currency_code),
            },
            {
              key: 'invoice_date',
              header: 'Date',
              accessor: 'invoice_date',
              sortable: true,
              render: (row) => formatISODate(row.invoice_date),
            },
          ]}
        />
      </div>
    </div>
  );
};
