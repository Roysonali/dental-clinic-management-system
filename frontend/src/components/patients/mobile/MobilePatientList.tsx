import { useState, type FC } from 'react';
import { Users } from 'lucide-react';
import { MobileSearchFilterBar } from '../../../layouts/components/mobile/MobileSearchFilterBar';
import { MobileCardList } from '../../../layouts/components/mobile/MobileCardList';
import { MobileFilterSheet } from '../../../layouts/components/mobile/MobileFilterSheet';
import { MobileListPagination } from '../../../layouts/components/mobile/MobileListPagination';
import { Select } from '../../common/Input';
import type { PatientListItem, PatientStatusFilter } from '../../../types/patient';
import { MobilePatientCard } from './MobilePatientCard';

interface MobilePatientListProps {
  patients: PatientListItem[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  /** Search input (bound to the same server-side `search` param as desktop). */
  searchValue: string;
  onSearchChange: (value: string) => void;
  /** Active/inactive/all filter (server-side `is_active`). */
  status: PatientStatusFilter;
  onStatusChange: (value: PatientStatusFilter) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onView: (patient: PatientListItem) => void;
  page: number;
  totalPages: number;
  totalCount?: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

/**
 * MobilePatientList — mobile presentation of the patient list.
 *
 * Search + filter button (opens the filter sheet), then stacked patient
 * cards. Same server-side data and filter state as the desktop table — only
 * the presentation differs. Loading/error/empty states come from the shared
 * MobileCardList; pagination stays server-driven via MobileListPagination.
 */
export const MobilePatientList: FC<MobilePatientListProps> = ({
  patients,
  loading,
  error,
  onRetry,
  searchValue,
  onSearchChange,
  status,
  onStatusChange,
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
        searchPlaceholder="Search patients"
      />

      <MobileCardList
        items={patients}
        loading={loading}
        error={error}
        onRetry={onRetry}
        emptyIcon={Users}
        emptyTitle="No patients found"
        emptyDescription="Patients you register will appear here."
        hasActiveFilters={hasActiveFilters}
        onClearFilters={onClearFilters}
        loadingLabel="Loading patients"
        getKey={(patient) => patient.id}
        renderCard={(patient) => (
          <MobilePatientCard patient={patient} onClick={() => onView(patient)} />
        )}
      />

      <MobileListPagination
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />

      <MobileFilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filter patients"
        hasActiveFilters={hasActiveFilters}
        onClearFilters={onClearFilters}
      >
        <Select
          label="Status"
          options={[
            { value: 'all', label: 'All statuses' },
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]}
          value={status}
          onChange={(e) => onStatusChange(e.target.value as PatientStatusFilter)}
        />
      </MobileFilterSheet>
    </div>
  );
};
