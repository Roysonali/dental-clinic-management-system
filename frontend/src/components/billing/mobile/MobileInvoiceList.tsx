import type { FC } from 'react';
import { Search, SlidersHorizontal, FileText } from 'lucide-react';
import { Button } from '../../common/Button/Button';
import { Icon } from '../../common/Icon/Icon';
import { Skeleton } from '../../common/Skeleton/Skeleton';
import { EmptyState } from '../../common/EmptyState/EmptyState';
import { ResultState } from '../../common/ResultState/ResultState';
import { Pagination } from '../../common/Pagination/Pagination';
import { INVOICE_PAGE_SIZE_OPTIONS } from '../../../constants/billing';
import type { InvoiceListItem } from '../../../types/billing';
import { MobileInvoiceCard } from './MobileInvoiceCard';

interface MobileInvoiceListProps {
  invoices: InvoiceListItem[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onView: (invoice: InvoiceListItem) => void;
  /** Search input (bound to the same server-side `query` param as desktop). */
  searchValue: string;
  onSearchChange: (value: string) => void;
  /** Opens the mobile filter sheet. */
  onOpenFilters: () => void;
  /** Pagination (server-driven, same params as the desktop table). */
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const inputClass =
  'h-12 w-full rounded-2xl border border-neutral-300 bg-white pl-11 pr-4 text-base text-neutral-800 transition-colors duration-150 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20';

/**
 * MobileInvoiceList — reference mobile invoice list (screen 47).
 *
 * Search row (search input + filter button) above a stacked column of large
 * invoice cards. Same server-side data and filter state as the desktop
 * table — only the presentation differs. Loading renders card-shaped
 * skeletons, errors reuse the shared ResultState, empty reuses the shared
 * EmptyState. The shared Pagination sits below the cards so server-side
 * pagination behaviour is preserved.
 */
export const MobileInvoiceList: FC<MobileInvoiceListProps> = ({
  invoices,
  loading,
  error,
  onRetry,
  hasActiveFilters,
  onClearFilters,
  onView,
  searchValue,
  onSearchChange,
  onOpenFilters,
  page,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
  onPageSizeChange,
}) => {
  return (
    <div className="flex w-full min-w-0 flex-col gap-4 px-6 pb-24">
      {/* Search + Filter */}
      <div className="flex items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <Icon
            icon={Search}
            size="md"
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400"
          />
          <input
            type="search"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search invoices"
            aria-label="Search invoices"
            className={inputClass}
          />
        </div>
        <button
          type="button"
          onClick={onOpenFilters}
          aria-label="Open filters"
          aria-haspopup="dialog"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-primary-500 bg-white text-primary-600 transition-colors duration-150 hover:bg-primary-50 active:bg-primary-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
        >
          <Icon icon={SlidersHorizontal} size="md" />
        </button>
      </div>

      {/* Loading → card skeletons */}
      {loading && (
        <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading invoices">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="custom" className="h-36 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {/* Error → shared error state with retry */}
      {!loading && error && (
        <ResultState
          variant="error"
          title="Could not load invoices"
          description={error}
          actions={
            <Button variant="primary" onClick={onRetry}>
              Retry
            </Button>
          }
        />
      )}

      {/* Empty → shared empty state */}
      {!loading && !error && invoices.length === 0 && (
        <EmptyState
          icon={FileText}
          title={hasActiveFilters ? 'No invoices match these filters' : 'No invoices yet'}
          description={
            hasActiveFilters
              ? 'Try adjusting the search or clearing the filters.'
              : 'Invoices you create will appear here.'
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
      {!loading && !error && invoices.length > 0 && (
        <div className="flex flex-col gap-4">
          {invoices.map((invoice) => (
            <MobileInvoiceCard
              key={invoice.id}
              invoice={invoice}
              onClick={() => onView(invoice)}
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
              {INVOICE_PAGE_SIZE_OPTIONS.map((opt) => (
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
