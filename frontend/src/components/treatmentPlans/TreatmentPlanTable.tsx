import type { FC } from 'react';
import { Eye } from 'lucide-react';
import { DataTable } from '../common/DataTable/DataTable';
import { Button } from '../common/Button/Button';
import { Icon } from '../common/Icon/Icon';
import { TreatmentPlanStatusBadge } from './TreatmentPlanStatusBadge';
import { TREATMENT_PLAN_CURRENCY_SYMBOL } from '../../constants/treatmentPlan';
import { formatFee } from '../../utils/formatting';
import { formatISODate } from '../../utils/date';
import type { EnrichedTreatmentPlan } from '../../types/treatmentPlan';

interface TreatmentPlanTableProps {
  plans: EnrichedTreatmentPlan[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onView: (plan: EnrichedTreatmentPlan) => void;
  onRowClick: (plan: EnrichedTreatmentPlan) => void;
}

/**
 * TreatmentPlanTable — S-01 list table ([MAP §7.1]).
 *
 * Server-side pagination/sorting via DataTable columns; plan_code renders as
 * a link; patient/doctor fall back to `Patient #id` / `Doctor #id` when
 * name resolution is unavailable (R10). Row click navigates to the detail
 * page.
 */
export const TreatmentPlanTable: FC<TreatmentPlanTableProps> = ({
  plans,
  loading,
  error,
  onRetry,
  onView,
  onRowClick,
}) => {
  return (
    <DataTable
      columns={[
        {
          key: 'plan_code',
          header: 'Plan Code',
          accessor: 'plan_code',
          sortable: true,
          render: (plan) => (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onView(plan);
              }}
              className="font-medium text-primary-600 underline-offset-2 transition-colors hover:text-primary-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              {plan.plan_code}
            </button>
          ),
        },
        {
          key: 'patient',
          header: 'Patient',
          render: (plan) => plan.patient_name ?? `Patient #${plan.patient_id}`,
        },
        {
          key: 'doctor',
          header: 'Doctor',
          render: (plan) => plan.doctor_name ?? `Doctor #${plan.doctor_id}`,
        },
        {
          key: 'status',
          header: 'Status',
          accessor: 'status',
          sortable: true,
          render: (plan) => <TreatmentPlanStatusBadge status={plan.status} />,
        },
        {
          key: 'version',
          header: 'Ver.',
          accessor: 'current_version',
          render: (plan) => plan.current_version,
        },
        {
          key: 'items',
          header: 'Items',
          accessor: 'item_count',
          render: (plan) => plan.item_count,
        },
        {
          key: 'total',
          header: 'Total Cost',
          accessor: 'total_estimated_cost',
          align: 'right',
          render: (plan) => formatFee(plan.total_estimated_cost, TREATMENT_PLAN_CURRENCY_SYMBOL),
        },
        {
          key: 'created_at',
          header: 'Created',
          accessor: 'created_at',
          sortable: true,
          render: (plan) => formatISODate(plan.created_at),
        },
      ]}
      data={plans}
      rowKey={(plan) => plan.id}
      loading={loading}
      error={error}
      onRetry={onRetry}
      loadingRows={5}
      ariaLabel="Treatment plans"
      emptyTitle="No treatment plans found"
      emptyDescription="Try adjusting your search or filters, or create a new treatment plan."
      onRowClick={onRowClick}
      rowActionsHeader=""
      rowActions={(plan) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onView(plan)}
          leftIcon={<Icon icon={Eye} size="xs" />}
          aria-label={`View treatment plan ${plan.plan_code}`}
        >
          View
        </Button>
      )}
    />
  );
};
