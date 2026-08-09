import { useState, type FC } from 'react';
import { Stethoscope } from 'lucide-react';
import { MobileSearchFilterBar } from '../../../layouts/components/mobile/MobileSearchFilterBar';
import { MobileCardList } from '../../../layouts/components/mobile/MobileCardList';
import { MobileFilterSheet } from '../../../layouts/components/mobile/MobileFilterSheet';
import { MobileListPagination } from '../../../layouts/components/mobile/MobileListPagination';
import { Select } from '../../common/Input';
import type {
  DoctorAvailabilityFilter,
  DoctorResponse,
  DoctorStatusFilter,
  SpecializationResponse,
} from '../../../types/doctor';
import { MobileDoctorCard } from './MobileDoctorCard';

interface MobileDoctorListProps {
  doctors: DoctorResponse[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  /** Search input (server-side `search`). */
  searchValue: string;
  onSearchChange: (value: string) => void;
  /** Active/inactive filter (server-side `is_active`). */
  status: DoctorStatusFilter;
  onStatusChange: (value: DoctorStatusFilter) => void;
  /** Availability filter (server-side `is_available`). */
  availability: DoctorAvailabilityFilter;
  onAvailabilityChange: (value: DoctorAvailabilityFilter) => void;
  /** Specialization options + filter (server-side `specialization_id`). */
  specializations: SpecializationResponse[];
  specializationId: number | null;
  onSpecializationChange: (value: number | null) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onView: (doctor: DoctorResponse) => void;
  page: number;
  totalPages: number;
  totalCount?: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

/**
 * MobileDoctorList — mobile presentation of the doctor list.
 *
 * Search + filter button, stacked doctor cards, and the existing server-side
 * status/availability/specialization filters inside the shared filter sheet —
 * every control maps 1:1 to the desktop GET /doctors params.
 */
export const MobileDoctorList: FC<MobileDoctorListProps> = ({
  doctors,
  loading,
  error,
  onRetry,
  searchValue,
  onSearchChange,
  status,
  onStatusChange,
  availability,
  onAvailabilityChange,
  specializations,
  specializationId,
  onSpecializationChange,
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
        searchPlaceholder="Search doctors"
      />

      <MobileCardList
        items={doctors}
        loading={loading}
        error={error}
        onRetry={onRetry}
        emptyIcon={Stethoscope}
        emptyTitle="No doctors found"
        emptyDescription="Doctors you register will appear here."
        hasActiveFilters={hasActiveFilters}
        onClearFilters={onClearFilters}
        loadingLabel="Loading doctors"
        getKey={(doctor) => doctor.id}
        renderCard={(doctor) => (
          <MobileDoctorCard doctor={doctor} onClick={() => onView(doctor)} />
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
        title="Filter doctors"
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
          onChange={(e) => onStatusChange(e.target.value as DoctorStatusFilter)}
        />
        <Select
          label="Availability"
          options={[
            { value: 'all', label: 'All doctors' },
            { value: 'available', label: 'Available for appointments' },
            { value: 'unavailable', label: 'Unavailable' },
          ]}
          value={availability}
          onChange={(e) => onAvailabilityChange(e.target.value as DoctorAvailabilityFilter)}
        />
        <Select
          label="Specialization"
          placeholder="All specializations"
          options={specializations.map((s) => ({ value: String(s.id), label: s.name }))}
          value={specializationId != null ? String(specializationId) : ''}
          onChange={(e) =>
            onSpecializationChange(e.target.value === '' ? null : Number(e.target.value))
          }
        />
      </MobileFilterSheet>
    </div>
  );
};
