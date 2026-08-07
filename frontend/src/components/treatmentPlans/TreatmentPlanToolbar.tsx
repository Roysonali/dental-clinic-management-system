import type { FC } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '../common/Button/Button';
import { SearchBar } from '../common/SearchBar/SearchBar';
import { Select } from '../common/Input/Select';
import { Icon } from '../common/Icon/Icon';
import { DatePicker } from '../common/Input/DatePicker';
import {
  TREATMENT_PLAN_SORT_OPTIONS,
  TREATMENT_PLAN_STATUS_FILTERS,
} from '../../constants/treatmentPlan';
import type { TreatmentPlanActiveFilter, TreatmentPlanStatusFilter } from '../../hooks/treatmentPlans/useTreatmentPlanFilters';
import type { PlanSortField, SortOrder } from '../../types/treatmentPlan';

interface TreatmentPlanToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchLoading?: boolean;
  status: TreatmentPlanStatusFilter;
  onStatusChange: (value: TreatmentPlanStatusFilter) => void;
  active: TreatmentPlanActiveFilter;
  onActiveChange: (value: TreatmentPlanActiveFilter) => void;
  doctorId: string;
  onDoctorChange: (value: string) => void;
  /** Doctor dropdown options (active doctors from useDoctors). */
  doctorOptions: { value: string; label: string }[];
  doctorsLoading?: boolean;
  dateFrom: string;
  onDateFromChange: (value: string) => void;
  dateTo: string;
  onDateToChange: (value: string) => void;
  sortBy: PlanSortField;
  onSortByChange: (value: PlanSortField) => void;
  sortOrder: SortOrder;
  onSortOrderChange: (value: SortOrder) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onCreate: () => void;
}

/**
 * TreatmentPlanToolbar — S-01 search + filters + Create button ([MAP §3.1]).
 *
 * Every control maps to a SERVER-SIDE query param via the filters hook; the
 * toolbar is purely presentational. Search is debounced by the container.
 */
export const TreatmentPlanToolbar: FC<TreatmentPlanToolbarProps> = ({
  searchValue,
  onSearchChange,
  searchLoading = false,
  status,
  onStatusChange,
  active,
  onActiveChange,
  doctorId,
  onDoctorChange,
  doctorOptions,
  doctorsLoading = false,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderChange,
  hasActiveFilters,
  onClearFilters,
  onCreate,
}) => {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="w-full lg:max-w-sm">
          <SearchBar
            value={searchValue}
            onChange={onSearchChange}
            placeholder="Search by plan code or patient…"
            loading={searchLoading}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={onClearFilters} leftIcon={<Icon icon={X} size="xs" />}>
              Clear
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={onCreate} leftIcon={<Icon icon={Plus} size="xs" />}>
            Create Plan
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-40">
          <Select
            label="Status"
            options={TREATMENT_PLAN_STATUS_FILTERS}
            value={status}
            onChange={(e) => onStatusChange(e.target.value as TreatmentPlanStatusFilter)}
          />
        </div>
        <div className="w-44">
          <Select
            label="Active"
            options={[
              { value: 'all', label: 'All' },
              { value: 'active', label: 'Active only' },
              { value: 'inactive', label: 'Inactive' },
            ]}
            value={active}
            onChange={(e) => onActiveChange(e.target.value as TreatmentPlanActiveFilter)}
          />
        </div>
        <div className="w-52">
          <Select
            label="Doctor"
            placeholder={doctorsLoading ? 'Loading…' : 'All doctors'}
            options={doctorOptions}
            value={doctorId}
            onChange={(e) => onDoctorChange(e.target.value)}
            disabled={doctorsLoading}
          />
        </div>
        <div className="w-40">
          <DatePicker
            label="From"
            value={dateFrom || undefined}
            onChange={(value) => onDateFromChange(value)}
          />
        </div>
        <div className="w-40">
          <DatePicker
            label="To"
            value={dateTo || undefined}
            onChange={(value) => onDateToChange(value)}
          />
        </div>
        <div className="w-44">
          <Select
            label="Sort"
            options={TREATMENT_PLAN_SORT_OPTIONS}
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value as PlanSortField)}
          />
        </div>
        <div className="w-32">
          <Select
            label="Order"
            options={[
              { value: 'desc', label: 'Newest first' },
              { value: 'asc', label: 'Oldest first' },
            ]}
            value={sortOrder}
            onChange={(e) => onSortOrderChange(e.target.value as SortOrder)}
          />
        </div>
      </div>
    </div>
  );
};
