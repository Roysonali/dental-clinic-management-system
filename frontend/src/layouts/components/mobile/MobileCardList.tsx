import { Fragment, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Skeleton } from '../../../components/common/Skeleton/Skeleton';
import { EmptyState } from '../../../components/common/EmptyState/EmptyState';
import { ResultState } from '../../../components/common/ResultState/ResultState';
import { Button } from '../../../components/common/Button/Button';

interface MobileCardListProps<T> {
  /** Items to render as cards. */
  items: T[];
  /** Renders one card per item (module-specific content). */
  renderCard: (item: T) => ReactNode;
  /** Returns a stable unique key per item (used for React reconciliation). */
  getKey?: (item: T) => string | number;
  /** List query loading state. */
  loading: boolean;
  /** Safe error message (already parsed). */
  error?: string | null;
  /** Retry callback for the shared error state. */
  onRetry?: () => void;
  /** Empty-state title. */
  emptyTitle: string;
  /** Empty-state description. */
  emptyDescription: string;
  /** Optional empty-state icon. */
  emptyIcon?: LucideIcon;
  /** When filters/search are active, empty state offers "Clear filters". */
  hasActiveFilters?: boolean;
  /** Clears all filters (empty-state action). */
  onClearFilters?: () => void;
  /** Accessible label for the loading region. */
  loadingLabel?: string;
  /** Number of skeleton cards while loading. */
  skeletonCount?: number;
  /** Skeleton card height (defaults to a standard 9rem list card). */
  skeletonHeight?: string;
}

/**
 * MobileCardList — shared scaffolding for mobile card-list screens.
 *
 * Handles the four list states (loading skeletons shaped like cards, the
 * shared ResultState error with retry, the shared EmptyState with an
 * optional clear-filters action, and the rendered card stack) so every
 * module's mobile list renders identically. The per-module card content is
 * injected via `renderCard` — no duplicated state handling per module.
 *
 * Sits above a page-level Pagination where server-side paging applies.
 */
export function MobileCardList<T>({
  items,
  renderCard,
  getKey,
  loading,
  error = null,
  onRetry,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  hasActiveFilters = false,
  onClearFilters,
  loadingLabel = 'Loading',
  skeletonCount = 3,
  skeletonHeight = 'h-36',
}: MobileCardListProps<T>) {
  /* ── Loading → card-shaped skeletons ─────────────────────────── */
  if (loading) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label={loadingLabel}>
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <Skeleton key={i} variant="custom" className={`w-full rounded-2xl ${skeletonHeight}`} />
        ))}
      </div>
    );
  }

  /* ── Error → shared error state with retry ───────────────────── */
  if (error) {
    return (
      <ResultState
        variant="error"
        title="Could not load data"
        description={error}
        actions={
          onRetry ? (
            <Button variant="primary" onClick={onRetry}>
              Retry
            </Button>
          ) : undefined
        }
      />
    );
  }

  /* ── Empty → shared empty state ──────────────────────────────── */
  if (items.length === 0) {
    return (
      <EmptyState
        icon={emptyIcon}
        title={hasActiveFilters ? 'Nothing matches these filters' : emptyTitle}
        description={
          hasActiveFilters
            ? 'Try adjusting the search or clearing the filters.'
            : emptyDescription
        }
        primaryAction={
          hasActiveFilters && onClearFilters ? (
            <Button variant="secondary" onClick={onClearFilters}>
              Clear filters
            </Button>
          ) : undefined
        }
      />
    );
  }

  /* ── Cards ───────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col gap-4">
      {items.map((item, index) => {
        const card = renderCard(item);
        if (getKey) {
          return <Fragment key={getKey(item)}>{card}</Fragment>;
        }
        // Fallback index key keeps React reconciliation stable without
        // requiring every module to pass a key.
        return <Fragment key={index}>{card}</Fragment>;
      })}
    </div>
  );
}
