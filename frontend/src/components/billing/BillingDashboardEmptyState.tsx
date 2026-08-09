import type { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { Receipt, CreditCard, PlusCircle } from 'lucide-react';
import { EmptyState } from '../common/EmptyState/EmptyState';
import { Button } from '../common/Button/Button';
import { Icon } from '../common/Icon/Icon';
import { ROUTES, INVOICE_CREATE_QUERY_PARAM } from '../../routes/routes';

/**
 * BillingDashboardEmptyState — centered empty state when there is no billing
 * activity (no invoices, payments or credit notes — derived from the
 * backend's own count totals, never from fake data).
 *
 * KPI cards above still show zero values. "New invoice" navigates to the
 * Invoice List route (Phase 2, Sprint 14A.2) WITH the create intent
 * (`?create=true`) so the list auto-opens its create drawer — the dashboard
 * CTA carries the user's intent through. "Record payment" navigates to the
 * Payment List route (Phase 3, Sprint 14A.3).
 */
export const BillingDashboardEmptyState: FC = () => {
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
            onClick={() => navigate(`${ROUTES.BILLING_INVOICES}?${INVOICE_CREATE_QUERY_PARAM}=true`)}
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
