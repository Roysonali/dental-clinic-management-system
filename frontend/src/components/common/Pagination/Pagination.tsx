import type { FC, ReactNode } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '../Button/Button';
import { Icon } from '../Icon/Icon';

interface PaginationProps {
  /** Current page (1-based) */
  currentPage: number;
  /** Total number of pages */
  totalPages: number;
  /** Called when page changes */
  onPageChange: (page: number) => void;
  /** Show first/last buttons */
  showFirstLast?: boolean;
  /** Number of visible page buttons (excluding ellipsis) */
  siblingCount?: number;
  /** Page size selector slot */
  pageSizeSelector?: ReactNode;
  /** Total item count display */
  totalCount?: number;
  /** Page size (for display) */
  pageSize?: number;
  /** Additional classes */
  className?: string;
}

/**
 * Pagination — page navigation for data tables and lists.
 *
 * @example
 * ```tsx
 * <Pagination
 *   currentPage={1}
 *   totalPages={10}
 *   onPageChange={(page) => setPage(page)}
 *   totalCount={100}
 *   pageSize={10}
 * />
 * ```
 */
export const Pagination: FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  showFirstLast = true,
  siblingCount = 1,
  pageSizeSelector,
  totalCount,
  pageSize,
  className = '',
}) => {
  if (totalPages <= 1) return null;

  const getPageNumbers = (): (number | 'ellipsis')[] => {
    const total = totalPages;
    const current = currentPage;
    const siblings = siblingCount;

    // Case 1: Few pages — show all
    if (total <= 3 + siblings * 2) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    const leftSiblingIndex = Math.max(current - siblings, 1);
    const rightSiblingIndex = Math.min(current + siblings, total);

    const showLeftEllipsis = leftSiblingIndex > 2;
    const showRightEllipsis = rightSiblingIndex < total - 1;

    if (!showLeftEllipsis && showRightEllipsis) {
      const leftCount = 2 + 2 * siblings;
      const leftRange = Array.from({ length: leftCount }, (_, i) => i + 1);
      return [...leftRange, 'ellipsis', total];
    }

    if (showLeftEllipsis && !showRightEllipsis) {
      const rightCount = 2 + 2 * siblings;
      const rightRange = Array.from({ length: rightCount }, (_, i) => total - rightCount + i + 1);
      return [1, 'ellipsis', ...rightRange];
    }

    return [
      1,
      'ellipsis',
      ...Array.from({ length: rightSiblingIndex - leftSiblingIndex + 1 }, (_, i) => leftSiblingIndex + i),
      'ellipsis',
      total,
    ];
  };

  const pages = getPageNumbers();
  const startItem = totalCount != null ? (currentPage - 1) * (pageSize ?? 0) + 1 : null;
  const endItem = totalCount != null ? Math.min(currentPage * (pageSize ?? 0), totalCount) : null;

  return (
    <div className={`flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${className}`}>
      {/* Info */}
      {totalCount != null && startItem != null && endItem != null && (
        <p className="text-body-sm text-neutral-500">
          <span className="hidden sm:inline">{startItem}–{endItem} of </span>
          {totalCount} results
        </p>
      )}

      {/* Page controls */}
      <div className="flex items-center gap-1">
        {/* First */}
        {showFirstLast && (
          <Button
            variant="ghost"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(1)}
            aria-label="First page"
          >
            <Icon icon={ChevronsLeft} size="sm" />
          </Button>
        )}

        {/* Previous */}
        <Button
          variant="ghost"
          size="sm"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Previous page"
        >
          <Icon icon={ChevronLeft} size="sm" />
        </Button>

        {/* Page numbers */}
        {pages.map((page, i) =>
          page === 'ellipsis' ? (
            <span key={`ellipsis-${i}`} className="px-1.5 text-body-sm text-neutral-400 select-none">
              ...
            </span>
          ) : (
            <Button
              key={page}
              variant={page === currentPage ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => onPageChange(page)}
              aria-label={`Page ${page}`}
              aria-current={page === currentPage ? 'page' : undefined}
            >
              {page}
            </Button>
          ),
        )}

        {/* Next */}
        <Button
          variant="ghost"
          size="sm"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Next page"
        >
          <Icon icon={ChevronRight} size="sm" />
        </Button>

        {/* Last */}
        {showFirstLast && (
          <Button
            variant="ghost"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(totalPages)}
            aria-label="Last page"
          >
            <Icon icon={ChevronsRight} size="sm" />
          </Button>
        )}
      </div>

      {/* Page size selector */}
      {pageSizeSelector && (
        <div className="flex items-center gap-2">
          <span className="text-caption text-neutral-500">Rows per page:</span>
          {pageSizeSelector}
        </div>
      )}
    </div>
  );
};
