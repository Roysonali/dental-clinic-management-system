import type { FC } from 'react';
import { ArrowUpRight, Unlink } from 'lucide-react';
import { Card } from '../../common/Card/Card';
import { Button } from '../../common/Button/Button';
import { IconButton } from '../../common/Button/IconButton';
import { Icon } from '../../common/Icon/Icon';
import { Tooltip } from '../../common/Tooltip/Tooltip';
import { Badge } from '../../common/Badge';
import { DataTable, type DataTableColumn } from '../../common/DataTable';
import { PAYMENT_CURRENCY_CODE } from '../../../constants/billing';
import { formatCurrency } from '../../../utils/formatting';
import { formatISODateTime } from '../../../utils/date';
import type { PaymentAllocationSummary } from '../../../types/billing';

interface PaymentAllocationsCardProps {
  allocations: PaymentAllocationSummary[];
  loading?: boolean;
  /** True when the payment is completed with a positive unallocated balance. */
  canAllocate: boolean;
  onAllocate: () => void;
  onDeallocate: (allocation: PaymentAllocationSummary) => void;
}

/**
 * PaymentAllocationsCard — ALLOCATIONS card on the payment detail page
 * (reference spec §31). Header actions are state-driven: Allocate only when
 * the payment is completed with unallocated balance. Rows show the linked
 * invoice, grand total, allocated amount, allocation type (Allocation vs
 * Refund badge) and creation time. Refund allocations are read-only; the
 * deallocate action targets payment allocations only (backend contract).
 */
export const PaymentAllocationsCard: FC<PaymentAllocationsCardProps> = ({
  allocations,
  loading = false,
  canAllocate,
  onAllocate,
  onDeallocate,
}) => {
  const columns: DataTableColumn<PaymentAllocationSummary>[] = [
    {
      key: 'invoice',
      header: 'Invoice',
      render: (alloc) =>
        alloc.invoice ? (
          <div className="min-w-0">
            <p className="font-mono text-label font-medium text-neutral-900">
              {alloc.invoice.invoice_number}
            </p>
            <p className="mt-0.5 text-caption text-neutral-400">{alloc.invoice.patient.patient_code}</p>
          </div>
        ) : (
          <span className="text-neutral-400">—</span>
        ),
    },
    {
      key: 'patient',
      header: 'Patient',
      render: (alloc) =>
        alloc.invoice ? (
          <span className="truncate text-body font-medium text-neutral-900">
            {alloc.invoice.patient.full_name}
          </span>
        ) : (
          <span className="text-neutral-400">—</span>
        ),
    },
    {
      key: 'grand_total',
      header: 'Invoice Grand Total',
      align: 'right',
      render: (alloc) =>
        alloc.invoice ? (
          <span className="whitespace-nowrap tabular-nums text-neutral-600">
            {formatCurrency(alloc.invoice.grand_total, PAYMENT_CURRENCY_CODE)}
          </span>
        ) : (
          <span className="text-neutral-400">—</span>
        ),
    },
    {
      key: 'allocated_amount',
      header: 'Allocated Amount',
      align: 'right',
      render: (alloc) => (
        <span className="whitespace-nowrap font-medium text-neutral-900 tabular-nums">
          {formatCurrency(alloc.allocated_amount, PAYMENT_CURRENCY_CODE)}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (alloc) =>
        alloc.is_refund ? (
          <Badge variant="info" size="sm">Refund</Badge>
        ) : (
          <Badge variant="neutral" size="sm">Allocation</Badge>
        ),
    },
    {
      key: 'created_at',
      header: 'Created At',
      render: (alloc) => (
        <span className="whitespace-nowrap text-neutral-600">{formatISODateTime(alloc.created_at)}</span>
      ),
    },
  ];

  return (
    <Card>
      <Card.Header
        title="Allocations"
        actions={
          <div className="flex items-center gap-2">
            {canAllocate && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onAllocate}
                leftIcon={<Icon icon={ArrowUpRight} size="xs" />}
              >
                Allocate
              </Button>
            )}
          </div>
        }
      />
      <Card.Body>
        <DataTable
          columns={columns}
          data={allocations}
          rowKey={(alloc) => alloc.id}
          loading={loading}
          loadingRows={3}
          ariaLabel="Payment allocations"
          tableClassName="min-w-[640px]"
          emptyTitle="No allocations yet"
          emptyDescription="Allocate this payment to a payable invoice to apply it."
          rowActionsHeader="Actions"
          rowActions={(alloc) =>
            alloc.is_refund || !alloc.invoice ? (
              <span className="text-caption text-neutral-300">—</span>
            ) : (
              <Tooltip content="Remove allocation">
                <IconButton
                  icon={<Icon icon={Unlink} size="sm" />}
                  aria-label={`Remove allocation to ${alloc.invoice.invoice_number}`}
                  variant="ghost"
                  size="sm"
                  className="hover:text-danger focus-visible:ring-danger/30"
                  onClick={() => onDeallocate(alloc)}
                />
              </Tooltip>
            )
          }
        />
      </Card.Body>
    </Card>
  );
};
