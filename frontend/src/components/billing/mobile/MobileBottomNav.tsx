import type { FC } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, CreditCard, Receipt, type LucideIcon } from 'lucide-react';
import { ROUTES } from '../../../routes/routes';
import { Icon } from '../../common/Icon/Icon';

interface BottomNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  route: string;
}

/**
 * Fixed bottom navigation for the mobile billing list screens (reference
 * screens 47/48). Four items — Dashboard, Invoices, Payments, Receipts —
 * each 25% width, icon above a small label. The active screen renders blue,
 * the rest muted slate.
 *
 * NOTE: the backend exposes no receipts LIST route (only
 * /billing/receipts/{id} detail pages), so the Receipts item points at the
 * Billing Dashboard — the receipts entry point — instead of a broken link.
 * Active matching is exact (not prefix), so /billing/invoices never
 * highlights the /billing-based Receipts item.
 */
const NAV_ITEMS: BottomNavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, route: ROUTES.DASHBOARD },
  { id: 'invoices', label: 'Invoices', icon: FileText, route: ROUTES.BILLING_INVOICES },
  { id: 'payments', label: 'Payments', icon: CreditCard, route: ROUTES.BILLING_PAYMENTS },
  { id: 'receipts', label: 'Receipts', icon: Receipt, route: ROUTES.BILLING },
];

export const MobileBottomNav: FC = () => {
  const location = useLocation();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white"
    >
      <div className="grid grid-cols-4">
        {NAV_ITEMS.map((item) => {
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
