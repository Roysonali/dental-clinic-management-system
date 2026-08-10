import type { FC } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { Icon } from '../../../components/common/Icon/Icon';

interface MobileSearchFilterBarProps {
  /** Search input value (bound to the same server-side search param as desktop). */
  searchValue: string;
  /** Search input change handler. */
  onSearchChange: (value: string) => void;
  /** Opens the mobile filter sheet. */
  onOpenFilters: () => void;
  /** Placeholder / accessible label for the search input. */
  searchPlaceholder: string;
  /** Accessible label for the filter button (defaults to "Open filters"). */
  filterLabel?: string;
}

const inputClass =
  'h-12 w-full rounded-2xl border border-neutral-300 bg-white pl-11 pr-4 text-base text-neutral-800 transition-colors duration-150 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20';

/**
 * MobileSearchFilterBar — shared mobile search + filter row (reference
 * screen 47). A full-width search input with a blue filter button beside it.
 * Filters are intentionally NOT spread across the page — the filter button
 * opens the module's mobile filter sheet, so the row never overflows the
 * viewport. 48px touch targets throughout.
 */
export const MobileSearchFilterBar: FC<MobileSearchFilterBarProps> = ({
  searchValue,
  onSearchChange,
  onOpenFilters,
  searchPlaceholder,
  filterLabel = 'Open filters',
}) => {
  return (
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
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className={inputClass}
        />
      </div>
      <button
        type="button"
        onClick={onOpenFilters}
        aria-label={filterLabel}
        aria-haspopup="dialog"
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-primary-500 bg-white text-primary-600 transition-colors duration-150 hover:bg-primary-50 active:bg-primary-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
      >
        <Icon icon={SlidersHorizontal} size="md" />
      </button>
    </div>
  );
};
