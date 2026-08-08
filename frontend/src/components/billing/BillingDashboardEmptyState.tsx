import type { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { Receipt, CreditCard, PlusCircle } from 'lucide-react';
import { EmptyState } from '../common/EmptyState/EmptyState';
import { Button } from '../common/Button/Button';
import { Tooltip } from '../common/Tooltip/Tooltip';
import { Icon } from '../common/Icon/Icon';
import { ROUTES } from '../../routes/routes';

/**
 * BillingDashboardEmptyState — centered empty state when there is no billing
 * activity (no invoices, payments or credit notes — derived from the
 * backend's own count totals, never from fake data).
 *
 * KPI cards above still show zero values. "New invoice" navigates to the
 * Invoice List route now that Phase 2 (Sprint 14A.2) ships it; "Record
 * payment" stays disabled with an explanatory tooltip because the Payment
 * workflow belongs to a later phase.
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
            onClick={() => navigate(ROUTES.BILLING_INVOICES)}
            leftIcon={<Icon icon={PlusCircle} size="sm" />}
          >
            New invoice
          </Button>
        }
        secondaryAction={
          <Tooltip content="Record payment arrives in the Payments phase">
            <Button
              variant="secondary"
              disabled
              leftIcon={<Icon icon={CreditCard} size="sm" />}
            >
              Record payment
            </Button>
          </Tooltip>
        }
      />
    </div>
  );
};
