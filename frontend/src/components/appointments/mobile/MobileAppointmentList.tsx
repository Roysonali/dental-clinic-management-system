import { useState, type FC } from 'react';
import { CalendarClock } from 'lucide-react';
import { MobileSearchFilterBar } from '../../../layouts/components/mobile/MobileSearchFilterBar';
import { MobileCardList } from '../../../layouts/components/mobile/MobileCardList';
import { MobileFilterSheet } from '../../../layouts/components/mobile/MobileFilterSheet';
import { MobileListPagination } from '../../../layouts/components/mobile/MobileListPagination';
import { Select } from '../../common/Input';
import { APPOINTMENT_STATUS_FILTERS } from '../../../constants/appointment';
import type { AppointmentStatusFilter } from '../../../constants/appointment';
import type { EnrichedAppointment } from '../../../types/appointment';
import { MobileAppointmentCard } from './MobileAppointmentCard';

interface MobileAppointmentListProps {
  appointments: EnrichedAppointment[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  /** Search input (client-side filter over the current page — matches desktop). */
  searchValue: string;
  onSearchChange: (value: string) => void;
  /** Status filter (client-side — the backend exposes none). */
  status: AppointmentStatusFilter;
  onStatusChange: (value: AppointmentStatusFilter) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onView: (appointment: EnrichedAppointment) => void;
  /** Pagination (0/1 hides it — the container hides paging while a
   * client-side filter is active, matching the desktop behaviour). */
  page: number;
  totalPages: number;
  totalCount?: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

/**
 * MobileAppointmentList — mobile presentation of the appointment list.
 *
 * Search + filter button, stacked appointment cards, and the same
 * client-side status/search behaviour as the desktop table (the backend
 * exposes no appointment filters). States + pagination via the shared
 * mobile primitives.
 */
export const MobileAppointmentList: FC<MobileAppointmentListProps> = ({
  appointments,
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
        searchPlaceholder="Search appointments"
      />

      <MobileCardList
        items={appointments}
        loading={loading}
        error={error}
        onRetry={onRetry}
        emptyIcon={CalendarClock}
        emptyTitle="No appointments found"
        emptyDescription="Appointments you schedule will appear here."
        hasActiveFilters={hasActiveFilters}
        onClearFilters={onClearFilters}
        loadingLabel="Loading appointments"
        getKey={(appointment) => appointment.id}
        renderCard={(appointment) => (
          <MobileAppointmentCard
            appointment={appointment}
            onClick={() => onView(appointment)}
          />
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
        title="Filter appointments"
        hasActiveFilters={hasActiveFilters}
        onClearFilters={onClearFilters}
      >
        <Select
          label="Status"
          options={APPOINTMENT_STATUS_FILTERS.map((s) => ({ value: s.value, label: s.label }))}
          value={status}
          onChange={(e) => onStatusChange(e.target.value as AppointmentStatusFilter)}
        />
      </MobileFilterSheet>
    </div>
  );
};
