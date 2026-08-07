import type { FC } from 'react';
import { Pencil, Power, Trash2 } from 'lucide-react';
import { DataTable } from '../common/DataTable/DataTable';
import { Button } from '../common/Button/Button';
import { Icon } from '../common/Icon/Icon';
import { PermissionGate } from '../rbac/PermissionGate';
import { ProcedureStatusBadge } from './procedureStatusBadge';
import { TREATMENT_PLAN_CURRENCY_SYMBOL } from '../../constants/treatmentPlan';
import { PROCEDURE_CATEGORY_LABELS } from '../../constants/procedure';
import { ADMIN_ROLES } from '../../constants/roles';
import { formatFee } from '../../utils/formatting';
import type { ProcedureResponse } from '../../types/procedure';

interface ProcedureTableProps {
  procedures: ProcedureResponse[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  /** Admin (⭐) capabilities — triggers are gated by the caller's PermissionGate. */
  onEdit: (procedure: ProcedureResponse) => void;
  onToggleActive: (procedure: ProcedureResponse) => void;
  onDelete: (procedure: ProcedureResponse) => void;
}

/**
 * ProcedureTable — S-07 catalog table ([MAP §7.2]).
 *
 * Row action triggers are exposed unconditionally; the PARENT wraps them in
 * `PermissionGate` (⭐ = ADMIN + CHIEF_DOCTOR) so non-admins never see the
 * buttons — backend-first RBAC ([MAP §9]).
 */
export const ProcedureTable: FC<ProcedureTableProps> = ({
  procedures,
  loading,
  error,
  onRetry,
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
          align: 'right',
          render: (p) => formatFee(p.default_cost, TREATMENT_PLAN_CURRENCY_SYMBOL),
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
      emptyTitle="No procedures found"
      emptyDescription="Try adjusting your search or filters, or add a new procedure."
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
