import type { FC } from 'react';
import { MobileFilterSheet as MobileFilterSheetShell } from '../../../layouts/components/mobile/MobileFilterSheet';
import { Select, DatePicker } from '../../common/Input';
import { PatientPicker } from '../../appointments/PatientPicker';
import { INVOICE_SORT_OPTIONS, INVOICE_STATUS_OPTIONS } from '../../../constants/billing';
import type { InvoiceStatusFilter } from '../../../hooks/billing/useInvoiceFilters';
import type { InvoiceSortField, SortOrder } from '../../../types/billing';

interface MobileFilterSheetProps {
  open: boolean;
  onClose: () => void;
  status: InvoiceStatusFilter;
  onStatusChange: (value: InvoiceStatusFilter) => void;
  patientId: string;
  onPatientChange: (value: string) => void;
  doctorId: string;
  onDoctorChange: (value: string) => void;
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
}

/**
 * MobileFilterSheet — mobile presentation of the existing server-side
 * invoice filters (reference screen 47: the filter button opens a
 * mobile-friendly sheet, never the full desktop toolbar).
 *
 * Composes the shared MobileFilterSheet shell (Drawer backdrop, Escape,
 * focus trap, scroll lock, pinned footer) with the same Select / DatePicker
 * / PatientPicker controls as the desktop InvoiceToolbar — every control
 * maps 1:1 to a GET /billing/invoices query param, so filters stay
 * backend-compatible. Changes apply live (server-side); the footer just
 * closes the sheet or clears all filters.
 */
export const MobileFilterSheet: FC<MobileFilterSheetProps> = ({
  open,
  onClose,
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
}) => {
  return (
    <MobileFilterSheetShell
      open={open}
      onClose={onClose}
      title="Filter invoices"
      hasActiveFilters={hasActiveFilters}
      onClearFilters={onClearFilters}
    >
      <PatientPicker value={patientId} onChange={onPatientChange} helperText="Optional" />
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
        options={[
          { value: 'all', label: 'All statuses' },
          ...INVOICE_STATUS_OPTIONS,
        ]}
        value={status}
        onChange={(e) => onStatusChange(e.target.value as InvoiceStatusFilter)}
      />
      <DatePicker
        label="Invoice from"
        value={dateFrom || undefined}
        onChange={(value) => onDateFromChange(value)}
      />
      <DatePicker
        label="Invoice to"
        value={dateTo || undefined}
        onChange={(value) => onDateToChange(value)}
      />
      <Select
        label="Sort by"
        options={INVOICE_SORT_OPTIONS}
        value={sortBy}
        onChange={(e) => onSortByChange(e.target.value as InvoiceSortField)}
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
    </MobileFilterSheetShell>
  );
};
