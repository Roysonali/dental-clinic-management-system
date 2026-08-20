import type { FC } from 'react';
import { GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { DataTable } from '../common/DataTable/DataTable';
import { Button } from '../common/Button/Button';
import { Icon } from '../common/Icon/Icon';
import { Badge } from '../common/Badge/Badge';
import { TREATMENT_PLAN_CURRENCY_CODE } from '../../constants/treatmentPlan';
import { formatCurrency } from '../../utils/formatting';
import { formatToothLabel } from '../../utils/treatmentPlanFormatting';
import type { TreatmentPlanItemResponse } from '../../types/treatmentPlan';

interface TreatmentPlanItemsTableProps {
  items: TreatmentPlanItemResponse[];
  /** False hides edit controls (plan status not editable — backend 409). */
  editable: boolean;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onAddItem: () => void;
  onEditItem: (item: TreatmentPlanItemResponse) => void;
  onRemoveItem: (item: TreatmentPlanItemResponse) => void;
  /** Row click opens the read-only ItemDetailsDrawer. */
  onRowClick?: (item: TreatmentPlanItemResponse) => void;
}

/**
 * TreatmentPlanItemsTable — plan items list (S-02/S-04, [MAP §7.1]).
 *
 * Rows are always rendered; edit controls (Add/Edit/Remove/Reorder) only
 * appear when `editable` — derived from the plan status via
 * `isEditableStatus` (backend 409 otherwise). `item_status` renders as a
 * read-only badge — no item-status transitions exist (O2/U2).
 */
export const TreatmentPlanItemsTable: FC<TreatmentPlanItemsTableProps> = ({
  items,
  editable,
  loading = false,
  error = null,
  onRetry,
  onAddItem,
  onEditItem,
  onRemoveItem,
  onRowClick,
}) => {
  return (
    <DataTable
      columns={[
        {
          key: 'sequence',
          header: '#',
          accessor: 'sequence_number',
          width: 'w-14',
          render: (item) => item.sequence_number,
        },
        {
          key: 'procedure',
          header: 'Procedure',
          render: (item) =>
            item.procedure ? (
              <div>
                <p className="font-medium text-neutral-900">{item.procedure.name}</p>
                <p className="text-caption text-neutral-400">{item.procedure.code}</p>
              </div>
            ) : (
              <span className="text-neutral-400">Procedure #{item.procedure_id}</span>
            ),
        },
        {
          key: 'tooth',
          header: 'Tooth',
          render: (item) => formatToothLabel(item.tooth_number, item.tooth_surface),
        },
        {
          key: 'position',
          header: 'Position',
          render: (item) =>
            item.quadrant || item.arch ? [item.quadrant, item.arch].filter(Boolean).join(' · ') : '—',
        },
        {
          key: 'cost',
          header: 'Est. Cost',
          align: 'right',
          cellClassName: 'tabular-nums',
          render: (item) => formatCurrency(item.estimated_cost, TREATMENT_PLAN_CURRENCY_CODE),
        },
        {
          key: 'discount',
          header: 'Discount',
          align: 'right',
          cellClassName: 'tabular-nums',
          render: (item) => (item.discount ? formatCurrency(item.discount, TREATMENT_PLAN_CURRENCY_CODE) : '—'),
        },
        {
          key: 'status',
          header: 'Status',
          render: () => (
            <Badge variant="neutral" size="sm">
              Pending
            </Badge>
          ),
        },
        {
          key: 'notes',
          header: 'Notes',
          render: (item) => item.notes ?? <span className="text-neutral-400">—</span>,
        },
      ]}
      data={items}
      rowKey={(item) => item.id}
      loading={loading}
      error={error ?? undefined}
      onRetry={onRetry}
      loadingRows={3}
      ariaLabel="Treatment plan items"
      emptyTitle="No items yet"
      emptyDescription={
        editable
          ? 'Add procedures to this treatment plan to begin building the estimate.'
          : 'This treatment plan has no items.'
      }
      emptyAction={
        editable ? (
          <Button variant="primary" size="sm" onClick={onAddItem} leftIcon={<Icon icon={Plus} size="xs" />}>
            Add Item
          </Button>
        ) : undefined
      }
      onRowClick={editable || onRowClick ? onRowClick : undefined}
      rowActionsHeader=""
      rowActions={
        editable
          ? (item) => (
              <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                <span className="cursor-grab text-neutral-300" title="Drag to reorder (via Reorder dialog)">
                  <Icon icon={GripVertical} size="sm" />
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  aria-label={`Edit item ${item.sequence_number}`}
                  onClick={() => onEditItem(item)}
                >
                  <Icon icon={Pencil} size="sm" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  aria-label={`Remove item ${item.sequence_number}`}
                  onClick={() => onRemoveItem(item)}
                >
                  <Icon icon={Trash2} size="sm" className="text-danger" />
                </Button>
              </div>
            )
          : undefined
      }
    />
  );
};
