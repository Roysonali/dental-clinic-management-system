import type { FC } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '../../common/Button/Button';
import { SearchBar } from '../../common/SearchBar/SearchBar';
import { Select } from '../../common/Input/Select';
import { DatePicker } from '../../common/Input/DatePicker';
import { Icon } from '../../common/Icon/Icon';
import { PatientPicker } from '../../appointments/PatientPicker';
import {
  INVOICE_SORT_OPTIONS,
  INVOICE_STATUS_OPTIONS,
} from '../../../constants/billing';
import type { InvoiceStatusFilter } from '../../../hooks/billing/useInvoiceFilters';
import type { InvoiceSortField, SortOrder } from '../../../types/billing';

interface InvoiceToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchLoading?: boolean;
  status: InvoiceStatusFilter;
  onStatusChange: (value: InvoiceStatusFilter) => void;
  patientId: string;
  onPatientChange: (value: string) => void;
  doctorId: string;
  onDoctorChange: (value: string) => void;
  /** Doctor dropdown options (active doctors from useDoctors). */
  doctorOptions: { value: string; label: string }[];
  doctorsLoading?: boolean;
  dateFrom: string;
  onDateFromChange: (value: string) => void;
  dateTo: string;
  onDateToChange: (value: string) => void;
  sortBy: InvoiceSortField;
  onSortByChange: (value: InvoiceSortField) => void;
  sortOrder: SortOrder;
  onSortOrderChange: (value: SortOrder) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onCreate: () => void;
}

/**
 * InvoiceToolbar — search + server-side filters + "New invoice" CTA.
 *
 * Every control maps to a GET /billing/invoices query param via the filters
 * hook (query, status, patient_id, doctor_id, date_from, date_to, sort_by,
 * sort_order). Nothing is filtered client-side — the backend is the source
 * of truth, so ACTIVE FILTERS always equal VISIBLE DATA. Patient reuses the
 * shared PatientPicker (no duplicate patient search component).
 *
 * Layout (Sprint 14A.2 remediation):
 * - Search sits above the filters with a bounded desktop width (440px).
 * - The seven filter controls are grouped into two wrapping rows so the
 *   combined widths can never force the page wider than the viewport:
 *   Row 1 — entity/status filters (Patient / Doctor / Status)
 *   Row 2 — date range + sorting (Invoice from / Invoice to / Sort by / Order)
 *   Each row is `flex-wrap`, so on narrower viewports the controls reflow
 *   onto additional lines instead of overflowing horizontally.
 */
export const InvoiceToolbar: FC<InvoiceToolbarProps> = ({
  searchValue,
  onSearchChange,
  searchLoading = false,
  status,
  onStatusChange,
  patientId,
  onPatientChange,
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
    <div className="flex w-full min-w-0 flex-col gap-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="w-full lg:max-w-[440px]">
          <SearchBar
            value={searchValue}
            onChange={onSearchChange}
            placeholder="Search invoice number or patient name…"
            loading={searchLoading}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              leftIcon={<Icon icon={X} size="xs" />}
            >
              Clear
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={onCreate}
            leftIcon={<Icon icon={Plus} size="xs" />}
          >
            New invoice
          </Button>
        </div>
      </div>

      {/* Row 1 — entity & status filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-64">
          <PatientPicker value={patientId} onChange={onPatientChange} />
        </div>
        <div className="w-48">
          <Select
            label="Doctor"
            placeholder={doctorsLoading ? 'Loading…' : 'All doctors'}
            options={doctorOptions}
            value={doctorId}
            onChange={(e) => onDoctorChange(e.target.value)}
            disabled={doctorsLoading}
          />
        </div>
        <div className="w-44">
          <Select
            label="Status"
            options={[
              { value: 'all', label: 'All statuses' },
              ...INVOICE_STATUS_OPTIONS,
            ]}
            value={status}
            onChange={(e) => onStatusChange(e.target.value as InvoiceStatusFilter)}
          />
        </div>
      </div>

      {/* Row 2 — date range & sorting filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-40">
          <DatePicker
            label="Invoice from"
            value={dateFrom || undefined}
            onChange={(value) => onDateFromChange(value)}
          />
        </div>
        <div className="w-40">
          <DatePicker
            label="Invoice to"
            value={dateTo || undefined}
            onChange={(value) => onDateToChange(value)}
          />
        </div>
        <div className="w-44">
          <Select
            label="Sort by"
            options={INVOICE_SORT_OPTIONS}
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value as InvoiceSortField)}
          />
        </div>
        <div className="w-36">
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
