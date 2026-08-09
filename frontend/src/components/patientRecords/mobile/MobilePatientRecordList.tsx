import { useState, type FC } from 'react';
import { ClipboardList } from 'lucide-react';
import { MobileSearchFilterBar } from '../../../layouts/components/mobile/MobileSearchFilterBar';
import { MobileCardList } from '../../../layouts/components/mobile/MobileCardList';
import { MobileFilterSheet } from '../../../layouts/components/mobile/MobileFilterSheet';
import { MobileListPagination } from '../../../layouts/components/mobile/MobileListPagination';
import { Select } from '../../common/Input';
import { PATIENT_RECORD_PAGE_SIZE_OPTIONS } from '../../../constants/patientRecord';
import type { PatientRecordStatusFilter, FinalizedFilter } from '../../../hooks/patientRecords/usePatientRecordFilters';
import type { EnrichedPatientRecord } from '../../../types/patientRecord';
import { MobilePatientRecordCard } from './MobilePatientRecordCard';

interface MobilePatientRecordListProps {
  records: EnrichedPatientRecord[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  /** Search input (server-side `search` param). */
  searchValue: string;
  onSearchChange: (value: string) => void;
  /** Status filter (server-side `status`). */
  status: PatientRecordStatusFilter;
  onStatusChange: (value: PatientRecordStatusFilter) => void;
  /** Finalized filter (server-side `is_finalized`). */
  finalized: FinalizedFilter;
  onFinalizedChange: (value: FinalizedFilter) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onView: (record: EnrichedPatientRecord) => void;
  page: number;
  totalPages: number;
  totalCount?: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

/** Record status filter options (same values as the desktop toolbar). */
const RECORD_STATUS_OPTIONS: readonly { value: string; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'FINALIZED', label: 'Finalized' },
  { value: 'LOCKED', label: 'Locked' },
];

/**
 * MobilePatientRecordList — mobile presentation of the patient records list
 * (the module from the reference bug screenshot). Search + filter button,
 * stacked record cards, and the existing server-side status/finalized
 * filters inside the shared filter sheet — no filter controls spill outside
 * the viewport.
 */
export const MobilePatientRecordList: FC<MobilePatientRecordListProps> = ({
  records,
  loading,
  error,
  onRetry,
  searchValue,
  onSearchChange,
  status,
  onStatusChange,
  finalized,
  onFinalizedChange,
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
        searchPlaceholder="Search patient records"
      />

      <MobileCardList
        items={records}
        loading={loading}
        error={error}
        onRetry={onRetry}
        emptyIcon={ClipboardList}
        emptyTitle="No patient records found"
        emptyDescription="Clinical charts appear here once a record is created for an appointment."
        hasActiveFilters={hasActiveFilters}
        onClearFilters={onClearFilters}
        loadingLabel="Loading patient records"
        getKey={(record) => record.id}
        renderCard={(record) => (
          <MobilePatientRecordCard record={record} onClick={() => onView(record)} />
        )}
      />

      <MobileListPagination
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={pageSize}
        pageSizeOptions={PATIENT_RECORD_PAGE_SIZE_OPTIONS}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />

      <MobileFilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filter patient records"
        hasActiveFilters={hasActiveFilters}
        onClearFilters={onClearFilters}
      >
        <Select
          label="Status"
          options={RECORD_STATUS_OPTIONS}
          value={status}
          onChange={(e) => onStatusChange(e.target.value as PatientRecordStatusFilter)}
        />
        <Select
          label="Finalized"
          options={[
            { value: 'all', label: 'All records' },
            { value: 'finalized', label: 'Finalized only' },
            { value: 'not-finalized', label: 'Not finalized' },
          ]}
          value={finalized}
          onChange={(e) => onFinalizedChange(e.target.value as FinalizedFilter)}
        />
      </MobileFilterSheet>
    </div>
  );
};
