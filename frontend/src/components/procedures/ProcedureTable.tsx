import type { FC } from 'react';
import { Pencil, Plus, Power, Trash2 } from 'lucide-react';
import { DataTable } from '../common/DataTable/DataTable';
import { Button } from '../common/Button/Button';
import { Icon } from '../common/Icon/Icon';
import { PermissionGate } from '../rbac/PermissionGate';
import { ProcedureStatusBadge } from './procedureStatusBadge';
import { ProcedureToolbar } from './ProcedureToolbar';
import { TREATMENT_PLAN_CURRENCY_CODE } from '../../constants/treatmentPlan';
import { PROCEDURE_CATEGORY_LABELS } from '../../constants/procedure';
import { ADMIN_ROLES } from '../../constants/roles';
import { formatCurrency } from '../../utils/formatting';
import type { ProcedureCategory, ProcedureResponse } from '../../types/procedure';

interface ProcedureTableProps {
  /** Procedure rows to display */
  procedures: ProcedureResponse[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  /* ── Toolbar (search + filters + create) ── */
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchLoading?: boolean;
  category: ProcedureCategory | 'all';
  onCategoryChange: (category: ProcedureCategory | 'all') => void;
  status: 'all' | 'active' | 'inactive';
  onStatusChange: (status: 'all' | 'active' | 'inactive') => void;
  /** Opens the New Procedure drawer. */
  onCreate: () => void;
  /** Admin (⭐) capabilities — triggers are gated by the caller's PermissionGate. */
  onEdit: (procedure: ProcedureResponse) => void;
  onToggleActive: (procedure: ProcedureResponse) => void;
  onDelete: (procedure: ProcedureResponse) => void;
}

/**
 * ProcedureTable — S-07 catalog table ([MAP §7.2]).
 *
 * Renders the shared ProcedureToolbar through DataTable's toolbar slot
 * (column-visibility helpers flow from the table). Row action triggers are
 * exposed unconditionally; the PARENT wraps them in `PermissionGate` (⭐ =
 * ADMIN + CHIEF_DOCTOR) so non-admins never see the buttons — backend-first
 * RBAC ([MAP §9]).
 */
export const ProcedureTable: FC<ProcedureTableProps> = ({
  procedures,
  loading,
  error,
  onRetry,
  searchValue,
  onSearchChange,
  searchLoading = false,
  category,
  onCategoryChange,
  status,
  onStatusChange,
  onCreate,
  onEdit,
  onToggleActive,
  onDelete,
}) => {
  return (
    <DataTable
      columns={[
        {
          key: 'code',
          header: 'Code',
          accessor: 'code',
          sortable: true,
          render: (p) => <span className="font-mono text-label font-medium text-neutral-900">{p.code}</span>,
        },
        {
          key: 'name',
          header: 'Name',
          accessor: 'name',
          sortable: true,
          render: (p) => p.name,
        },
        {
          key: 'category',
          header: 'Category',
          accessor: 'category',
          sortable: true,
          render: (p) => PROCEDURE_CATEGORY_LABELS[p.category],
        },
        {
          key: 'cost',
          header: 'Default Cost',
          accessor: 'default_cost',
          sortable: true,
          // Backend wire format is a numeric STRING ("500.00") — sort
          // numerically so ₹15,000.00 > ₹500.00 (lexicographic would invert).
          sortValue: (p) => Number(p.default_cost),
          align: 'right',
          cellClassName: 'tabular-nums',
          render: (p) => formatCurrency(p.default_cost, TREATMENT_PLAN_CURRENCY_CODE),
        },
        {
          key: 'status',
          header: 'Status',
          render: (p) => <ProcedureStatusBadge isActive={p.is_active} />,
        },
      ]}
      data={procedures}
      rowKey={(p) => p.id}
      loading={loading}
      error={error}
      onRetry={onRetry}
      loadingRows={5}
      ariaLabel="Procedure catalog"
      toolbar={({ columnVisibility, setColumnVisibility }) => (
        <ProcedureToolbar
          searchValue={searchValue}
          onSearchChange={onSearchChange}
          searchLoading={searchLoading}
          category={category}
          onCategoryChange={onCategoryChange}
          status={status}
          onStatusChange={onStatusChange}
          onCreate={onCreate}
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={setColumnVisibility}
        />
      )}
      emptyTitle="No procedures found"
      emptyDescription="Try adjusting your search or filters, or add a new procedure."
      emptyAction={
        // Empty-state CTA is admin-only too (⭐ = ADMIN + CHIEF_DOCTOR).
        <PermissionGate requiredRoles={ADMIN_ROLES}>
          <Button
            size="md"
            onClick={onCreate}
            leftIcon={<Icon icon={Plus} size="md" />}
            className="shrink-0 whitespace-nowrap"
          >
            New Procedure
          </Button>
        </PermissionGate>
      }
      rowActionsHeader=""
      rowActions={(p) => (
        // Every write action is ⭐ (ADMIN + CHIEF_DOCTOR) — gated inline so
        // non-admins never see them (backend-first RBAC, [MAP §9]).
        <PermissionGate requiredRoles={ADMIN_ROLES}>
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              aria-label={`Edit ${p.code}`}
              onClick={() => onEdit(p)}
            >
              <Icon icon={Pencil} size="sm" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              aria-label={p.is_active ? `Deactivate ${p.code}` : `Activate ${p.code}`}
              onClick={() => onToggleActive(p)}
            >
              <Icon icon={Power} size="sm" className={p.is_active ? 'text-warning' : 'text-success'} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              aria-label={`Delete ${p.code}`}
              onClick={() => onDelete(p)}
              disabled={p.is_active}
              title={p.is_active ? 'Deactivate before deleting' : undefined}
            >
              <Icon icon={Trash2} size="sm" className="text-danger" />
            </Button>
          </div>
        </PermissionGate>
      )}
    />
  );
};
