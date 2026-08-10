import type { FC } from 'react';
import { X } from 'lucide-react';
import { Button } from '../../common/Button/Button';
import { Select } from '../../common/Input/Select';
import { DatePicker } from '../../common/Input/DatePicker';
import { Icon } from '../../common/Icon/Icon';
import { PatientPicker } from '../../appointments/PatientPicker';
import {
  PAYMENT_METHOD_OPTIONS,
  PAYMENT_SORT_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
} from '../../../constants/billing';
import type {
  PaymentMethodFilter,
  PaymentStatusFilter,
} from '../../../hooks/billing/usePaymentFilters';
import type { PaymentSortField, SortOrder } from '../../../types/billing';

interface PaymentToolbarProps {
  patientId: string;
  onPatientChange: (value: string) => void;
  method: PaymentMethodFilter;
  onMethodChange: (value: PaymentMethodFilter) => void;
  status: PaymentStatusFilter;
  onStatusChange: (value: PaymentStatusFilter) => void;
  dateFrom: string;
  onDateFromChange: (value: string) => void;
  dateTo: string;
  onDateToChange: (value: string) => void;
  sortBy: PaymentSortField;
  onSortByChange: (value: PaymentSortField) => void;
  sortOrder: SortOrder;
  onSortOrderChange: (value: SortOrder) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

/**
 * PaymentToolbar — compact, responsive server-side filter controls.
 *
 * Every control maps to a GET /billing/payments query param via the filters
 * hook (patient_id, payment_method, status, date_from, date_to, sort_by,
 * sort_order). The backend is the source of truth — ACTIVE FILTERS always
 * equal VISIBLE DATA — and the muted "Filters apply on the server" note makes
 * that contract explicit to the user (reference spec §8).
 *
 * Layout (overflow-safe, learned from the Sprint 14A.2 invoice remediation):
 * - Row 1 — entity/status filters: Patient / Method / Status
 * - Row 2 — date range + sorting: Payment from / Payment to / Sort by / Order
 * Each row is `flex-wrap`, so on narrower viewports the controls reflow onto
 * additional lines instead of forcing the page wider than the viewport.
 */
export const PaymentToolbar: FC<PaymentToolbarProps> = ({
  patientId,
  onPatientChange,
  method,
  onMethodChange,
  status,
  onStatusChange,
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
    <div className="flex w-full min-w-0 flex-col gap-3">
      {/* Row 1 — entity & status filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-64">
          <PatientPicker value={patientId} onChange={onPatientChange} />
        </div>
        <div className="w-48">
          <Select
            label="Method"
            placeholder="All methods"
            options={[
              { value: 'all', label: 'All methods' },
              ...PAYMENT_METHOD_OPTIONS,
            ]}
            value={method}
            onChange={(e) => onMethodChange(e.target.value as PaymentMethodFilter)}
          />
        </div>
        <div className="w-44">
          <Select
            label="Status"
            options={[
              { value: 'all', label: 'All statuses' },
              ...PAYMENT_STATUS_OPTIONS,
            ]}
            value={status}
            onChange={(e) => onStatusChange(e.target.value as PaymentStatusFilter)}
          />
        </div>
      </div>

      {/* Row 2 — date range & sorting filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-40">
          <DatePicker
            label="Payment from"
            value={dateFrom || undefined}
            onChange={(value) => onDateFromChange(value)}
          />
        </div>
        <div className="w-40">
          <DatePicker
            label="Payment to"
            value={dateTo || undefined}
            onChange={(value) => onDateToChange(value)}
          />
        </div>
        <div className="w-44">
          <Select
            label="Sort by"
            options={PAYMENT_SORT_OPTIONS}
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value as PaymentSortField)}
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

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            leftIcon={<Icon icon={X} size="xs" />}
            className="self-end"
          >
            Clear
          </Button>
        )}

        <p className="ml-auto self-end pb-1 text-caption text-neutral-400">
          Filters apply on the server
        </p>
      </div>
    </div>
  );
};
