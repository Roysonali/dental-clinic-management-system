import { useState, type FC } from 'react';
import { FileText } from 'lucide-react';
import { MobileSearchFilterBar } from '../../../layouts/components/mobile/MobileSearchFilterBar';
import { MobileCardList } from '../../../layouts/components/mobile/MobileCardList';
import { MobileFilterSheet } from '../../../layouts/components/mobile/MobileFilterSheet';
import { MobileListPagination } from '../../../layouts/components/mobile/MobileListPagination';
import { Select, DatePicker } from '../../common/Input';
import {
  TREATMENT_PLAN_STATUS_FILTERS,
  TREATMENT_PLAN_SORT_OPTIONS,
  TREATMENT_PLAN_PAGE_SIZE_OPTIONS,
} from '../../../constants/treatmentPlan';
import type { TreatmentPlanStatusFilter, TreatmentPlanActiveFilter } from '../../../hooks/treatmentPlans/useTreatmentPlanFilters';
import type { EnrichedTreatmentPlan, PlanSortField, SortOrder } from '../../../types/treatmentPlan';
import { MobileTreatmentPlanCard } from './MobileTreatmentPlanCard';

interface MobileTreatmentPlanListProps {
  plans: EnrichedTreatmentPlan[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  /** Search input (server-side `search` param). */
  searchValue: string;
  onSearchChange: (value: string) => void;
  /* ── Filters (each maps 1:1 to a GET /treatment-plans query param) ── */
  status: TreatmentPlanStatusFilter;
  onStatusChange: (value: TreatmentPlanStatusFilter) => void;
  active: TreatmentPlanActiveFilter;
  onActiveChange: (value: TreatmentPlanActiveFilter) => void;
  doctorId: string;
  onDoctorChange: (value: string) => void;
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
  onView: (plan: EnrichedTreatmentPlan) => void;
  page: number;
  totalPages: number;
  totalCount?: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

/**
 * MobileTreatmentPlanList — mobile presentation of the treatment plan list.
 *
 * Search + filter button, stacked plan cards, and the full set of existing
 * server-side filters (status/active/doctor/date range/sort) inside the
 * shared filter sheet — every control maps 1:1 to the same GET params as
 * the desktop toolbar.
 */
export const MobileTreatmentPlanList: FC<MobileTreatmentPlanListProps> = ({
  plans,
  loading,
  error,
  onRetry,
  searchValue,
  onSearchChange,
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
  onView,
  page,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
  onPageSizeChange,
}) => {
  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <div className="flex w-full min-w-0 flex-col gap-4 pb-24">
      <MobileSearchFilterBar
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        onOpenFilters={() => setFiltersOpen(true)}
        searchPlaceholder="Search treatment plans"
      />

      <MobileCardList
        items={plans}
        loading={loading}
        error={error}
        onRetry={onRetry}
        emptyIcon={FileText}
        emptyTitle="No treatment plans found"
        emptyDescription="Treatment plans you create will appear here."
        hasActiveFilters={hasActiveFilters}
        onClearFilters={onClearFilters}
        loadingLabel="Loading treatment plans"
        getKey={(plan) => plan.id}
        renderCard={(plan) => (
          <MobileTreatmentPlanCard plan={plan} onClick={() => onView(plan)} />
        )}
      />

      <MobileListPagination
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={pageSize}
        pageSizeOptions={TREATMENT_PLAN_PAGE_SIZE_OPTIONS}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />

      <MobileFilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filter treatment plans"
        hasActiveFilters={hasActiveFilters}
        onClearFilters={onClearFilters}
      >
        <Select
          label="Doctor"
          placeholder={doctorsLoading ? 'Loading…' : 'All doctors'}
          options={doctorOptions}
          value={doctorId}
          onChange={(e) => onDoctorChange(e.target.value)}
          disabled={doctorsLoading}
        />
        <Select
          label="Status"
          options={TREATMENT_PLAN_STATUS_FILTERS.map((s) => ({ value: s.value, label: s.label }))}
          value={status}
          onChange={(e) => onStatusChange(e.target.value as TreatmentPlanStatusFilter)}
        />
        <Select
          label="Active"
          options={[
            { value: 'all', label: 'All plans' },
            { value: 'active', label: 'Active only' },
            { value: 'inactive', label: 'Inactive only' },
          ]}
          value={active}
          onChange={(e) => onActiveChange(e.target.value as TreatmentPlanActiveFilter)}
        />
        <DatePicker
          label="From date"
          value={dateFrom || undefined}
          onChange={(value) => onDateFromChange(value)}
        />
        <DatePicker
          label="To date"
          value={dateTo || undefined}
          onChange={(value) => onDateToChange(value)}
        />
        <Select
          label="Sort by"
          options={TREATMENT_PLAN_SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={sortBy}
          onChange={(e) => onSortByChange(e.target.value as PlanSortField)}
        />
        <Select
          label="Order"
          options={[
            { value: 'desc', label: 'Newest first' },
            { value: 'asc', label: 'Oldest first' },
          ]}
          value={sortOrder}
          onChange={(e) => onSortOrderChange(e.target.value as SortOrder)}
        />
      </MobileFilterSheet>
    </div>
  );
};
