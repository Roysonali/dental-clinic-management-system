import type { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { Receipt, CreditCard, PlusCircle } from 'lucide-react';
import { EmptyState } from '../common/EmptyState/EmptyState';
import { Button } from '../common/Button/Button';
import { Icon } from '../common/Icon/Icon';
import { ROUTES } from '../../routes/routes';

interface BillingDashboardEmptyStateProps {
  /**
   * Opens the create-invoice drawer ON the dashboard (the page owns the
   * open state) — the "New invoice" CTA never routes through the Invoice
   * List page.
   */
  onNewInvoice: () => void;
}

/**
 * BillingDashboardEmptyState — centered empty state when there is no billing
 * activity (no invoices, payments or credit notes — derived from the
 * backend's own count totals, never from fake data).
 *
 * KPI cards above still show zero values. "New invoice" delegates to
 * `onNewInvoice` (the dashboard opens its own create drawer directly).
 * "Record payment" navigates to the Payment List route (Phase 3, Sprint
 * 14A.3) — its page header opens the Record Payment drawer.
 */
export const BillingDashboardEmptyState: FC<BillingDashboardEmptyStateProps> = ({ onNewInvoice }) => {
  const navigate = useNavigate();

  return (
    <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
      <EmptyState
        icon={Receipt}
        title="No billing activity yet"
        description="Once you create an invoice or record a payment, totals and recent activity will appear here."
        primaryAction={
          <Button
            variant="primary"
            onClick={onNewInvoice}
            leftIcon={<Icon icon={PlusCircle} size="sm" />}
          >
            New invoice
          </Button>
        }
        secondaryAction={
          <Button
            variant="secondary"
            onClick={() => navigate(ROUTES.BILLING_PAYMENTS)}
            leftIcon={<Icon icon={CreditCard} size="sm" />}
          >
            Record payment
          </Button>
        }
      />
    </div>
  );
};
