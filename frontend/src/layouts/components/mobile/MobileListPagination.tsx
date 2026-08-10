import type { FC } from 'react';
import { Pagination } from '../../../components/common/Pagination/Pagination';

interface MobileListPaginationProps {
  /** 1-based current page. */
  page: number;
  /** Total pages (>= 1). */
  totalPages: number;
  /** Total record count. */
  totalCount?: number;
  /** Current page size. */
  pageSize: number;
  /** Page-size options; renders the rows-per-page selector when provided. */
  pageSizeOptions?: number[];
  /** Page change handler. */
  onPageChange: (page: number) => void;
  /** Page-size change handler (optional — hidden when omitted). */
  onPageSizeChange?: (size: number) => void;
}

/**
 * MobileListPagination — shared pagination block for mobile card lists.
 *
 * Uses the same shared Pagination as the desktop tables (server-side page
 * params are identical), with touch-friendly sizing and an optional
 * rows-per-page selector. Hidden entirely on single-page lists.
 */
export const MobileListPagination: FC<MobileListPaginationProps> = ({
  page,
  totalPages,
  totalCount,
  pageSize,
  pageSizeOptions,
  onPageChange,
  onPageSizeChange,
}) => {
  if (totalPages <= 1) return null;

  return (
    <Pagination
      currentPage={page}
      totalPages={totalPages}
      onPageChange={onPageChange}
      totalCount={totalCount}
      pageSize={pageSize}
      pageSizeSelector={
        onPageSizeChange && pageSizeOptions ? (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            aria-label="Rows per page"
            className="h-10 rounded-xl border border-neutral-300 bg-white px-2 text-caption text-neutral-700 transition-colors duration-150 hover:border-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        ) : undefined
      }
    />
  );
};
