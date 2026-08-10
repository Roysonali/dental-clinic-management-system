import type { FC } from 'react';
import {
  ArrowUpRight,
  Ban,
  CircleCheck,
  CircleX,
  Eye,
  Plus,
  Trash2,
} from 'lucide-react';
import { DataTable, type DataTableColumn, type SortState } from '../../common/DataTable';
import { Button } from '../../common/Button/Button';
import { IconButton } from '../../common/Button/IconButton';
import { Icon } from '../../common/Icon/Icon';
import { Tooltip } from '../../common/Tooltip/Tooltip';
import { StatusBadge } from '../../common/StatusBadge/StatusBadge';
import {
  PAYMENT_CURRENCY_CODE,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_VARIANTS,
} from '../../../constants/billing';
import { formatCurrency } from '../../../utils/formatting';
import { formatISODate, formatISODateTime } from '../../../utils/date';
import { PermissionGate } from '../../rbac/PermissionGate';
import { ADMIN_ROLES } from '../../../constants/roles';
import { getPaymentActions } from '../../../utils/paymentStateMachine';
import type { PaymentListItem } from '../../../types/billing';

interface PaymentTableProps {
  payments: PaymentListItem[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  sortState: SortState | null;
  onSortChange: (sort: SortState | null) => void;
  onView: (payment: PaymentListItem) => void;
  onRowClick: (payment: PaymentListItem) => void;
  onComplete: (payment: PaymentListItem) => void;
  onFail: (payment: PaymentListItem) => void;
  onVoid: (payment: PaymentListItem) => void;
  onAllocate: (payment: PaymentListItem) => void;
  onDelete: (payment: PaymentListItem) => void;
  onCreate: () => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
}

/**
 * PaymentTable — payment list table (Sprint 14A.3).
 *
 * Columns mirror backend `PaymentListItem` exactly. Row actions are
 * STATE-MACHINE driven via `getPaymentActions(status)` — a Pending payment
 * exposes Complete/Fail/Void/Delete, a Completed payment exposes Allocate
 * (the reference workflow: completed payments may be allocated to invoices),
 * and terminal statuses expose no lifecycle actions (the router exposes no
 * retry/reversal endpoint). Delete is additionally admin-gated via
 * PermissionGate (backend `_PAYMENT_DELETE_ROLES` = ADMIN).
 *
 * Financial values come verbatim from `financials`; the payment-number cell
 * shows the recorded datetime as muted secondary metadata.
 */
export const PaymentTable: FC<PaymentTableProps> = ({
  payments,
  loading,
  error,
  onRetry,
  sortState,
  onSortChange,
  onView,
  onRowClick,
  onComplete,
  onFail,
  onVoid,
  onAllocate,
  onDelete,
  onCreate,
  onClearFilters,
  hasActiveFilters,
}) => {
  const columns: DataTableColumn<PaymentListItem>[] = [
    {
      key: 'payment_number',
      header: 'Payment Number',
      sortable: true,
      render: (pay) => (
        <div className="min-w-0">
          <p className="font-mono text-label font-medium text-neutral-900">{pay.payment_number}</p>
          <p className="mt-0.5 text-caption text-neutral-400">{formatISODateTime(pay.created_at)}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (pay) => (
        <StatusBadge status={pay.status} statusMap={PAYMENT_STATUS_VARIANTS} size="sm" />
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
      key: 'payment_method',
      header: 'Method',
      sortable: true,
      render: (pay) => (
        <span className="whitespace-nowrap text-neutral-800">
          {PAYMENT_METHOD_LABELS[pay.payment_method]}
        </span>
      ),
    },
    {
      key: 'total_amount',
      header: 'Total Amount',
      align: 'right',
      sortable: true,
      render: (pay) => (
        <span className="whitespace-nowrap font-medium text-neutral-900 tabular-nums">
          {formatCurrency(pay.total_amount, PAYMENT_CURRENCY_CODE)}
        </span>
      ),
    },
    {
      key: 'allocated_amount',
      header: 'Allocated',
      align: 'right',
      render: (pay) => (
        <span className="whitespace-nowrap tabular-nums text-neutral-600">
          {formatCurrency(pay.financials.allocated_amount, PAYMENT_CURRENCY_CODE)}
        </span>
      ),
    },
    {
      key: 'unallocated_amount',
      header: 'Unallocated',
      align: 'right',
      render: (pay) => (
        <span className="whitespace-nowrap tabular-nums text-neutral-600">
          {formatCurrency(pay.financials.unallocated_amount, PAYMENT_CURRENCY_CODE)}
        </span>
      ),
    },
    {
      key: 'allocation_count',
      header: 'Allocations',
      align: 'right',
      render: (pay) => <span className="tabular-nums text-neutral-600">{pay.allocation_count}</span>,
    },
    {
      key: 'payment_date',
      header: 'Payment Date',
      sortable: true,
      render: (pay) => <span className="whitespace-nowrap">{formatISODate(pay.payment_date)}</span>,
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={payments}
      rowKey={(pay) => pay.id}
      loading={loading}
      error={error}
      onRetry={onRetry}
      loadingRows={5}
      ariaLabel="Payments"
      tableClassName="min-w-[1024px]"
      sortState={sortState}
      onSortChange={onSortChange}
      emptyTitle={hasActiveFilters ? 'No payments match these filters' : 'No payments yet'}
      emptyDescription={
        hasActiveFilters
          ? 'Adjust the method, status, or date range, then try again.'
          : 'Record your first payment to start tracking clinic receipts.'
      }
      emptyAction={
        hasActiveFilters ? (
          <Button variant="secondary" size="sm" onClick={onClearFilters}>
            Clear filters
          </Button>
        ) : (
          <Button variant="primary" size="sm" onClick={onCreate} leftIcon={<Icon icon={Plus} size="xs" />}>
            Record payment
          </Button>
        )
      }
      onRowClick={onRowClick}
      rowActionsHeader="Actions"
      rowActions={(pay) => {
        const actions = getPaymentActions(pay.status);
        return (
          <div className="flex items-center justify-end gap-1">
            <Tooltip content={`Open ${pay.payment_number}`}>
              <IconButton
                icon={<Icon icon={Eye} size="sm" />}
                aria-label={`Open payment ${pay.payment_number}`}
                variant="ghost"
                size="sm"
                onClick={() => onView(pay)}
              />
            </Tooltip>
            {actions.includes('complete') && (
              <Tooltip content="Complete payment">
                <IconButton
                  icon={<Icon icon={CircleCheck} size="sm" />}
                  aria-label={`Complete payment ${pay.payment_number}`}
                  variant="ghost"
                  size="sm"
                  onClick={() => onComplete(pay)}
                />
              </Tooltip>
            )}
            {actions.includes('allocate') && (
              <Tooltip content="Allocate to invoice">
                <IconButton
                  icon={<Icon icon={ArrowUpRight} size="sm" />}
                  aria-label={`Allocate payment ${pay.payment_number}`}
                  variant="ghost"
                  size="sm"
                  onClick={() => onAllocate(pay)}
                />
              </Tooltip>
            )}
            {actions.includes('fail') && (
              <Tooltip content="Mark as failed">
                <IconButton
                  icon={<Icon icon={CircleX} size="sm" />}
                  aria-label={`Mark payment ${pay.payment_number} as failed`}
                  variant="ghost"
                  size="sm"
                  className="hover:text-danger focus-visible:ring-danger/30"
                  onClick={() => onFail(pay)}
                />
              </Tooltip>
            )}
            {actions.includes('void') && (
              <Tooltip content="Void payment">
                <IconButton
                  icon={<Icon icon={Ban} size="sm" />}
                  aria-label={`Void payment ${pay.payment_number}`}
                  variant="ghost"
                  size="sm"
                  className="hover:text-danger focus-visible:ring-danger/30"
                  onClick={() => onVoid(pay)}
                />
              </Tooltip>
            )}
            {actions.includes('delete') && (
              // Delete is ADMIN-only on the backend (`_PAYMENT_DELETE_ROLES`);
              // gate the row action through the shared PermissionGate (hide
              // mode) so non-admin users never encounter it.
              <PermissionGate requiredRoles={ADMIN_ROLES} mode="hide">
                <Tooltip content="Delete payment">
                  <IconButton
                    icon={<Icon icon={Trash2} size="sm" />}
                    aria-label={`Delete payment ${pay.payment_number}`}
                    variant="ghost"
                    size="sm"
                    className="hover:text-danger focus-visible:ring-danger/30"
                    onClick={() => onDelete(pay)}
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
