import type { FC } from 'react';
import { Eye, PencilLine, Plus, Send, Trash2, XCircle } from 'lucide-react';
import { DataTable, type DataTableColumn, type SortState } from '../../common/DataTable';
import { Button } from '../../common/Button/Button';
import { IconButton } from '../../common/Button/IconButton';
import { Icon } from '../../common/Icon/Icon';
import { Tooltip } from '../../common/Tooltip/Tooltip';
import { StatusBadge } from '../../common/StatusBadge/StatusBadge';
import { INVOICE_STATUS_VARIANTS, PAYMENT_CURRENCY_CODE } from '../../../constants/billing';
import { formatCurrency } from '../../../utils/formatting';
import { formatISODate, formatISODateTime } from '../../../utils/date';
import { PermissionGate } from '../../rbac/PermissionGate';
import { ADMIN_ROLES } from '../../../constants/roles';
import { getInvoiceActions, isDraftInvoice } from '../../../utils/invoiceStateMachine';
import type { InvoiceListItem } from '../../../types/billing';

interface InvoiceTableProps {
  invoices: InvoiceListItem[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  sortState: SortState | null;
  onSortChange: (sort: SortState | null) => void;
  onView: (invoice: InvoiceListItem) => void;
  onRowClick: (invoice: InvoiceListItem) => void;
  onIssue: (invoice: InvoiceListItem) => void;
  onEdit: (invoice: InvoiceListItem) => void;
  onCancel: (invoice: InvoiceListItem) => void;
  onDelete: (invoice: InvoiceListItem) => void;
  /** Row actions for this page (used for empty-state CTA + delete gating). */
  onCreate: () => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
}

/**
 * InvoiceTable — invoice list table (Sprint 14A.2).
 *
 * Columns mirror backend `InvoiceListItem` exactly. Row actions are
 * STATE-MACHINE driven via `getInvoiceActions(status)` — a Draft exposes
 * Issue/Edit/Cancel/Delete, an Issued/Partial/Overdue invoice exposes only
 * Cancel, and Paid/terminal invoices expose no lifecycle actions (the
 * backend router exposes no void endpoint). Delete is additionally
 * admin-gated in the container via PermissionGate (backend `_INVOICE_DELETE_ROLES`).
 *
 * The "Invoice number" cell shows the backend's own temp `DRAFT-xxxx` number
 * for drafts with a muted "number assigned on issue" caption — no fabricated
 * numbers. Financial values come verbatim from `financials`.
 */
export const InvoiceTable: FC<InvoiceTableProps> = ({
  invoices,
  loading,
  error,
  onRetry,
  sortState,
  onSortChange,
  onView,
  onRowClick,
  onIssue,
  onEdit,
  onCancel,
  onDelete,
  onCreate,
  onClearFilters,
  hasActiveFilters,
}) => {
  const columns: DataTableColumn<InvoiceListItem>[] = [
    {
      key: 'invoice_number',
      header: 'Invoice Number',
      sortable: true,
      render: (inv) =>
        isDraftInvoice(inv.status) ? (
          <div className="min-w-0">
            <p className="font-mono text-label font-medium text-neutral-500">{inv.invoice_number}</p>
            <p className="mt-0.5 text-caption text-neutral-400">Draft — number assigned on issue</p>
          </div>
        ) : (
          <div className="min-w-0">
            <p className="font-mono text-label font-medium text-neutral-900">{inv.invoice_number}</p>
            <p className="mt-0.5 text-caption text-neutral-400">{formatISODate(inv.invoice_date)}</p>
          </div>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (inv) => (
        <StatusBadge status={inv.status} statusMap={INVOICE_STATUS_VARIANTS} size="sm" />
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
      key: 'doctor',
      header: 'Doctor',
      render: (inv) =>
        inv.doctor ? (
          <div className="min-w-0">
            <p className="truncate text-body font-medium text-neutral-900">{inv.doctor.user_full_name}</p>
            <p className="mt-0.5 text-caption text-neutral-400">{inv.doctor.doctor_code}</p>
          </div>
        ) : (
          <span className="text-neutral-400">—</span>
        ),
    },
    {
      key: 'invoice_date',
      header: 'Invoice Date',
      render: (inv) => <span className="whitespace-nowrap">{formatISODate(inv.invoice_date)}</span>,
    },
    {
      key: 'due_date',
      header: 'Due Date',
      sortable: true,
      render: (inv) => <span className="whitespace-nowrap">{formatISODate(inv.due_date)}</span>,
    },
    {
      // NOT sortable: the backend sort whitelist (`_ALLOWED_SORT_FIELDS`)
      // has no grand_total — an unknown sort field silently falls back to
      // the default (created_at), so a clickable header would sort wrongly.
      key: 'grand_total',
      header: 'Grand Total',
      align: 'right',
      render: (inv) => (
        <span className="whitespace-nowrap font-medium text-neutral-900 tabular-nums">
          {formatCurrency(inv.financials.grand_total, PAYMENT_CURRENCY_CODE)}
        </span>
      ),
    },
    {
      key: 'item_count',
      header: 'Items',
      align: 'right',
      render: (inv) => <span className="tabular-nums text-neutral-600">{inv.item_count}</span>,
    },
    {
      key: 'created_at',
      header: 'Created',
      sortable: true,
      render: (inv) => (
        <span className="whitespace-nowrap text-neutral-600">{formatISODateTime(inv.created_at)}</span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={invoices}
      rowKey={(inv) => inv.id}
      loading={loading}
      error={error}
      onRetry={onRetry}
      loadingRows={5}
      ariaLabel="Invoices"
      tableClassName="min-w-[1024px]"
      sortState={sortState}
      onSortChange={onSortChange}
      emptyTitle={hasActiveFilters ? 'No invoices match these filters' : 'No invoices yet'}
      emptyDescription={
        hasActiveFilters
          ? 'Try adjusting your search or filters.'
          : 'Create your first invoice to start tracking clinic billing.'
      }
      emptyAction={
        hasActiveFilters ? (
          <Button variant="secondary" size="sm" onClick={onClearFilters}>
            Clear filters
          </Button>
        ) : (
          <Button variant="primary" size="sm" onClick={onCreate} leftIcon={<Icon icon={Plus} size="xs" />}>
            New invoice
          </Button>
        )
      }
      onRowClick={onRowClick}
      rowActionsHeader="Actions"
      rowActions={(inv) => {
        const actions = getInvoiceActions(inv.status);
        if (actions.length === 0) return <span className="text-caption text-neutral-300">—</span>;
        return (
          <div className="flex items-center justify-end gap-1">
            <Tooltip content={`Open ${inv.invoice_number}`}>
              <IconButton
                icon={<Icon icon={Eye} size="sm" />}
                aria-label={`Open invoice ${inv.invoice_number}`}
                variant="ghost"
                size="sm"
                onClick={() => onView(inv)}
              />
            </Tooltip>
            {actions.includes('issue') && (
              <Tooltip content="Issue invoice">
                <IconButton
                  icon={<Icon icon={Send} size="sm" />}
                  aria-label={`Issue invoice ${inv.invoice_number}`}
                  variant="ghost"
                  size="sm"
                  onClick={() => onIssue(inv)}
                />
              </Tooltip>
            )}
            {actions.includes('edit') && (
              <Tooltip content="Edit draft">
                <IconButton
                  icon={<Icon icon={PencilLine} size="sm" />}
                  aria-label={`Edit invoice ${inv.invoice_number}`}
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(inv)}
                />
              </Tooltip>
            )}
            {actions.includes('cancel') && (
              <Tooltip content="Cancel invoice">
                <IconButton
                  icon={<Icon icon={XCircle} size="sm" />}
                  aria-label={`Cancel invoice ${inv.invoice_number}`}
                  variant="ghost"
                  size="sm"
                  className="hover:text-danger focus-visible:ring-danger/30"
                  onClick={() => onCancel(inv)}
                />
              </Tooltip>
            )}
            {actions.includes('delete') && (
              // Delete is ADMIN-only on the backend (`_INVOICE_DELETE_ROLES`);
              // gate the row action through the shared PermissionGate (hide
              // mode) so non-admin users never encounter it.
              <PermissionGate requiredRoles={ADMIN_ROLES} mode="hide">
                <Tooltip content="Delete draft">
                  <IconButton
                    icon={<Icon icon={Trash2} size="sm" />}
                    aria-label={`Delete invoice ${inv.invoice_number}`}
                    variant="ghost"
                    size="sm"
                    className="hover:text-danger focus-visible:ring-danger/30"
                    onClick={() => onDelete(inv)}
                  />
                </Tooltip>
              </PermissionGate>
            )}
          </div>
        );
      }}
    />
  );
};
