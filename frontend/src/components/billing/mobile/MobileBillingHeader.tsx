import type { FC } from 'react';
import { Menu, Plus } from 'lucide-react';
import { useMobileNav } from '../../../layouts/components/mobile/MobileNavContext';
import { Icon } from '../../common/Icon/Icon';

interface MobileBillingHeaderProps {
  /** Page title (e.g. "Invoices" / "Payments") */
  title: string;
  /** Accessible label for the primary add action (e.g. "New invoice"). */
  addLabel: string;
  /** Called when the top-right + button is tapped. */
  onAdd?: () => void;
}

/**
 * MobileBillingHeader — compact page header for the mobile billing list
 * screens (reference screens 47/48).
 *
 * Replaces the global header on the phone breakpoint: hamburger (opens the
 * app's slide-in navigation drawer via the shared MobileNavContext), large
 * bold page title, and an icon-only blue + action on the right. The + is
 * intentionally icon-only (no text label) per the reference. 48px touch
 * targets throughout.
 */
export const MobileBillingHeader: FC<MobileBillingHeaderProps> = ({
  title,
  addLabel,
  onAdd,
}) => {
  const { openNav } = useMobileNav();

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-neutral-200 bg-white px-6">
      <div className="flex min-w-0 items-center gap-4">
        <button
          type="button"
          onClick={openNav}
          aria-label="Open navigation"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-neutral-800 transition-colors duration-150 hover:bg-neutral-100 active:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <Icon icon={Menu} size="xl" />
        </button>
        <h1 className="truncate text-2xl font-bold tracking-tight text-neutral-900">
          {title}
        </h1>
      </div>

      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          aria-label={addLabel}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-sm transition-colors duration-150 hover:bg-primary-700 active:bg-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
        >
          <Icon icon={Plus} size="xl" />
        </button>
      )}
    </header>
  );
};
