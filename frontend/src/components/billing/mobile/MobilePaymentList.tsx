import type { FC } from 'react';
import { X, CreditCard } from 'lucide-react';
import { Button } from '../../common/Button/Button';
import { Icon } from '../../common/Icon/Icon';
import { Skeleton } from '../../common/Skeleton/Skeleton';
import { EmptyState } from '../../common/EmptyState/EmptyState';
import { ResultState } from '../../common/ResultState/ResultState';
import { Pagination } from '../../common/Pagination/Pagination';
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_PAGE_SIZE_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
} from '../../../constants/billing';
import { formatISODate } from '../../../utils/date';
import type { PaymentListItem } from '../../../types/billing';
import type {
  PaymentMethodFilter,
  PaymentStatusFilter,
} from '../../../hooks/billing/usePaymentFilters';
import { MobilePaymentCard } from './MobilePaymentCard';

interface MobilePaymentListProps {
  payments: PaymentListItem[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onView: (payment: PaymentListItem) => void;
  /** Active filters (mirror of the desktop toolbar) → horizontal chips. */
  method: PaymentMethodFilter;
  onMethodChange: (value: PaymentMethodFilter) => void;
  status: PaymentStatusFilter;
  onStatusChange: (value: PaymentStatusFilter) => void;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  /** Pagination (server-driven, same params as the desktop table). */
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

interface FilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}

const statusLabel = (status: PaymentStatusFilter): string =>
  status === 'all'
    ? 'All statuses'
    : (PAYMENT_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status);

/**
 * MobilePaymentList — reference mobile payment list (screen 48).
 *
 * Unlike the invoice list, the reference shows active filters as a single
 * horizontally scrolling row of blue-bordered chips directly below the
 * header. Each chip mirrors a server-side filter value (method/status/date
 * range) and is removable. Cards below use the same data + state as the
 * desktop table; the shared Pagination preserves server pagination.
 */
export const MobilePaymentList: FC<MobilePaymentListProps> = ({
  payments,
  loading,
  error,
  onRetry,
  hasActiveFilters,
  onClearFilters,
  onView,
  method,
  onMethodChange,
  status,
  onStatusChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  page,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
  onPageSizeChange,
}) => {
  const chips: FilterChip[] = [];
  if (method !== 'all') {
    const label = PAYMENT_METHOD_LABELS[method] ?? method;
    chips.push({ key: 'method', label: `Method: ${label}`, onRemove: () => onMethodChange('all') });
  }
  if (status !== 'all') {
    chips.push({ key: 'status', label: statusLabel(status), onRemove: () => onStatusChange('all') });
  }
  if (dateFrom && dateTo) {
    chips.push({
      key: 'date-range',
      label: `${formatISODate(dateFrom)} – ${formatISODate(dateTo)}`,
      onRemove: () => {
        onDateFromChange('');
        onDateToChange('');
      },
    });
  } else {
    if (dateFrom) {
      chips.push({
        key: 'date-from',
        label: `From ${formatISODate(dateFrom)}`,
        onRemove: () => onDateFromChange(''),
      });
    }
    if (dateTo) {
      chips.push({
        key: 'date-to',
        label: `To ${formatISODate(dateTo)}`,
        onRemove: () => onDateToChange(''),
      });
    }
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-4 pb-24">
      {/* Active filter chips (single horizontal row, scrolls, never wraps) */}
      {chips.length > 0 && (
        <div className="-mx-2 overflow-x-auto px-2 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max items-center gap-2">
            {chips.map((chip) => (
              <span
                key={chip.key}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border-2 border-primary-300 bg-white py-1.5 pl-3.5 pr-2 text-sm font-medium text-primary-700"
              >
                {chip.label}
                <button
                  type="button"
                  onClick={chip.onRemove}
                  aria-label={`Remove ${chip.label} filter`}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-primary-500 transition-colors duration-150 hover:bg-primary-50 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
                >
                  <Icon icon={X} size="sm" />
                </button>
              </span>
            ))}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={onClearFilters}>
                Clear all
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Loading → card skeletons */}
      {loading && (
        <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading payments">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="custom" className="h-36 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {/* Error → shared error state with retry */}
      {!loading && error && (
        <ResultState
          variant="error"
          title="Could not load payments"
          description={error}
          actions={
            <Button variant="primary" onClick={onRetry}>
              Retry
            </Button>
          }
        />
      )}

      {/* Empty → shared empty state */}
      {!loading && !error && payments.length === 0 && (
        <EmptyState
          icon={CreditCard}
          title={hasActiveFilters ? 'No payments match these filters' : 'No payments yet'}
          description={
            hasActiveFilters
              ? 'Try clearing the filters to see more payments.'
              : 'Payments you record will appear here.'
          }
          primaryAction={
            hasActiveFilters ? (
              <Button variant="secondary" onClick={onClearFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      )}

      {/* Cards */}
      {!loading && !error && payments.length > 0 && (
        <div className="flex flex-col gap-4">
          {payments.map((payment) => (
            <MobilePaymentCard
              key={payment.id}
              payment={payment}
              onClick={() => onView(payment)}
            />
          ))}
        </div>
      )}

      {/* Pagination (server-side, same as desktop) */}
      {!loading && !error && totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={onPageChange}
          totalCount={totalCount}
          pageSize={pageSize}
          pageSizeSelector={
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="Rows per page"
              className="h-10 rounded-xl border border-neutral-300 bg-white px-2 text-caption text-neutral-700 transition-colors duration-150 hover:border-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              {PAYMENT_PAGE_SIZE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          }
        />
      )}
    </div>
  );
};
