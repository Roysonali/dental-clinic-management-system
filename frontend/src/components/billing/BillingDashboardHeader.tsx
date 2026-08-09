import type { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, CreditCard } from 'lucide-react';
import { PageHeader } from '../common/PageHeader/PageHeader';
import { Button } from '../common/Button/Button';
import { Icon } from '../common/Icon/Icon';
import { ROUTES, INVOICE_CREATE_QUERY_PARAM } from '../../routes/routes';

/**
 * BillingDashboardHeader — page header for the Billing Dashboard.
 *
 * Quick actions are dashboard shortcuts ONLY:
 * - "New invoice" navigates to the Invoice List route (Phase 2, Sprint
 *   14A.2) WITH the create intent (`?create=true`) — the list detects it and
 *   opens its own create drawer automatically, so the user never clicks
 *   "New invoice" twice.
 * - "Record payment" navigates to the Payment List route now that Phase 3
 *   (Sprint 14A.3) ships it — the list's own page header opens the Record
 *   Payment drawer.
 *
 * Note: a second notification bell is intentionally NOT rendered here — the
 * application's global header (HeaderRight) already provides notifications.
 */
export const BillingDashboardHeader: FC = () => {
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
            onClick={() => navigate(`${ROUTES.BILLING_INVOICES}?${INVOICE_CREATE_QUERY_PARAM}=true`)}
            leftIcon={<Icon icon={PlusCircle} size="sm" />}
          >
            New invoice
          </Button>
        </>
      }
    />
  );
};
