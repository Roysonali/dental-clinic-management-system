import type { FC } from 'react';
import { Menu, Plus } from 'lucide-react';
import { useMobileNav } from './MobileNavContext';
import { Icon } from '../../../components/common/Icon/Icon';

interface MobilePageHeaderProps {
  /** Page title (e.g. "Patients" / "Appointments"). */
  title: string;
  /** Optional muted subtitle shown under the title. */
  subtitle?: string;
  /** Accessible label for the primary add action (e.g. "Register patient"). */
  addLabel?: string;
  /** Called when the top-right + button is tapped. */
  onAdd?: () => void;
}

/**
 * MobilePageHeader — shared compact header for mobile list screens.
 *
 * Replaces the global header on the phone breakpoint for list routes that
 * opt in: hamburger (opens the app's slide-in navigation drawer via the
 * shared MobileNavContext), large bold page title (with optional muted
 * subtitle), and an icon-only blue + action on the right. 48px touch
 * targets throughout.
 *
 * This is the single shared implementation used by Billing (reference
 * screens 47/48) and by every other module's mobile list screens — no
 * per-module duplicates.
 */
export const MobilePageHeader: FC<MobilePageHeaderProps> = ({
  title,
  subtitle,
  addLabel,
  onAdd,
}) => {
  const { openNav, isOpen = false } = useMobileNav();

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-neutral-200 bg-white px-6">
      <div className="flex min-w-0 items-center gap-4">
        <button
          type="button"
          onClick={openNav}
          aria-label="Open navigation"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-neutral-800 transition-colors duration-150 hover:bg-neutral-100 active:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <Icon icon={Menu} size="xl" />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight text-neutral-900">
            {title}
          </h1>
          {subtitle && (
            <p className="truncate text-sm text-neutral-500">{subtitle}</p>
          )}
        </div>
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
