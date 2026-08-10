import type { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, CreditCard } from 'lucide-react';
import { PageHeader } from '../common/PageHeader/PageHeader';
import { Button } from '../common/Button/Button';
import { Icon } from '../common/Icon/Icon';
import { ROUTES } from '../../routes/routes';

interface BillingDashboardHeaderProps {
  /**
   * Opens the create-invoice drawer ON the dashboard (the page owns the
   * open state) — the "New invoice" quick action never routes the user
   * through the Invoice List page.
   */
  onNewInvoice: () => void;
}

/**
 * BillingDashboardHeader — page header for the Billing Dashboard.
 *
 * Quick actions are dashboard shortcuts ONLY:
 * - "New invoice" delegates to `onNewInvoice` (the page opens its own create
 *   drawer directly — the user never passes through the Invoice List page).
 * - "Record payment" navigates to the Payment List route (Phase 3, Sprint
 *   14A.3) — the list's own page header opens the Record Payment drawer.
 *
 * Note: a second notification bell is intentionally NOT rendered here — the
 * application's global header (HeaderRight) already provides notifications.
 */
export const BillingDashboardHeader: FC<BillingDashboardHeaderProps> = ({ onNewInvoice }) => {
  const navigate = useNavigate();

  return (
    <PageHeader
      title="Billing Dashboard"
      subtitle="Clinic financial overview"
      actions={
        <>
          <Button
            variant="secondary"
            onClick={() => navigate(ROUTES.BILLING_PAYMENTS)}
            leftIcon={<Icon icon={CreditCard} size="sm" />}
          >
            Record payment
          </Button>
          <Button
            variant="primary"
            onClick={onNewInvoice}
            leftIcon={<Icon icon={PlusCircle} size="sm" />}
          >
            New invoice
          </Button>
        </>
      }
    />
  );
};
