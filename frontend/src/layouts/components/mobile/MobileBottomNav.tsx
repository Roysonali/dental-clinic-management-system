import type { FC } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, CreditCard, Receipt, type LucideIcon } from 'lucide-react';
import { ROUTES } from '../../../routes/routes';
import { Icon } from '../../../components/common/Icon/Icon';

export interface MobileBottomNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  route: string;
}

/**
 * Canonical mobile bottom navigation — the same four real destinations used
 * by the Billing reference screens (47/48): Dashboard, Invoices, Payments,
 * Receipts. All are actual app routes; no fake destinations.
 *
 * NOTE: the backend exposes no receipts LIST route (only
 * /billing/receipts/{id} detail pages), so the Receipts item points at the
 * Billing Dashboard — the receipts entry point — instead of a broken link.
 */
// eslint-disable-next-line react-refresh/only-export-components -- the default items are the component's config, part of this file's public API (same pattern as MobileNavContext.tsx).
export const DEFAULT_MOBILE_BOTTOM_NAV_ITEMS: MobileBottomNavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, route: ROUTES.DASHBOARD },
  { id: 'invoices', label: 'Invoices', icon: FileText, route: ROUTES.BILLING_INVOICES },
  { id: 'payments', label: 'Payments', icon: CreditCard, route: ROUTES.BILLING_PAYMENTS },
  { id: 'receipts', label: 'Receipts', icon: Receipt, route: ROUTES.BILLING },
];

interface MobileBottomNavProps {
  /** Bottom-nav items. Defaults to the canonical four destinations. */
  items?: MobileBottomNavItem[];
}

/**
 * MobileBottomNav — shared fixed bottom navigation for mobile screens.
 *
 * Fixed to the bottom of the viewport with a subtle top border; each item
 * is an icon above a label with a ≥64px touch target. The active screen
 * renders in primary blue, inactive items muted slate. Active matching is
 * exact (not prefix), so /billing/invoices never highlights the
 * /billing-based Receipts item.
 *
 * Content above must reserve bottom padding (pb-24) so the last card is
 * never hidden behind this bar.
 */
export const MobileBottomNav: FC<MobileBottomNavProps> = ({
  items = DEFAULT_MOBILE_BOTTOM_NAV_ITEMS,
}) => {
  const location = useLocation();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white"
    >
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const active = location.pathname === item.route;
          return (
            <Link
              key={item.id}
              to={item.route}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 py-2 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500 ${
                active ? 'text-primary-600' : 'text-neutral-400 hover:text-neutral-600'
              }`}
            >
              <Icon icon={item.icon} size="md" className={active ? 'text-primary-600' : ''} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
