import type { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, CreditCard } from 'lucide-react';
import { PageHeader } from '../common/PageHeader/PageHeader';
import { Button } from '../common/Button/Button';
import { Tooltip } from '../common/Tooltip/Tooltip';
import { Icon } from '../common/Icon/Icon';
import { ROUTES } from '../../routes/routes';

/**
 * BillingDashboardHeader — page header for the Billing Dashboard.
 *
 * Quick actions are dashboard shortcuts ONLY:
 * - "New invoice" navigates to the Invoice List route now that Phase 2
 *   (Sprint 14A.2) ships it — the list's own toolbar opens the create drawer.
 * - "Record payment" stays disabled with an explanatory tooltip: the Payment
 *   workflow belongs to a later Billing phase and must not fake functionality.
 *
 * Note: a second notification bell is intentionally NOT rendered here — the
 * application's global header (HeaderRight) already provides notifications.
 */
const RECORD_PAYMENT_HINT_ID = 'billing-record-payment-hint';
const RECORD_PAYMENT_HINT = 'Record payment arrives in the Payments phase';

export const BillingDashboardHeader: FC = () => {
  const navigate = useNavigate();

  return (
    <PageHeader
      title="Billing Dashboard"
      subtitle="Clinic financial overview"
      actions={
        <>
          <Tooltip content={RECORD_PAYMENT_HINT}>
            <Button
              variant="secondary"
              disabled
              aria-describedby={RECORD_PAYMENT_HINT_ID}
              leftIcon={<Icon icon={CreditCard} size="sm" />}
            >
              Record payment
            </Button>
          </Tooltip>
          <Button
            variant="primary"
            onClick={() => navigate(ROUTES.BILLING_INVOICES)}
            leftIcon={<Icon icon={PlusCircle} size="sm" />}
          >
            New invoice
          </Button>
          {/* Visually hidden explanation wired via aria-describedby for the
              disabled Record payment button (a natively disabled button
              cannot receive focus, so the hover tooltip is keyboard-unreachable). */}
          <span id={RECORD_PAYMENT_HINT_ID} className="sr-only">
            {RECORD_PAYMENT_HINT} — this workflow is not available yet.
          </span>
        </>
      }
    />
  );
};
