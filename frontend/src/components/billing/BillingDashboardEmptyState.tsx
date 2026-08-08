import type { FC } from 'react';
import { Receipt, CreditCard, PlusCircle } from 'lucide-react';
import { EmptyState } from '../common/EmptyState/EmptyState';
import { Button } from '../common/Button/Button';
import { Tooltip } from '../common/Tooltip/Tooltip';
import { Icon } from '../common/Icon/Icon';

/**
 * BillingDashboardEmptyState — centered empty state when there is no billing
 * activity (no invoices, payments or credit notes — derived from the
 * backend's own count totals, never from fake data).
 *
 * KPI cards above still show zero values. The CTA buttons render disabled:
 * the Invoice/Payment workflows are not part of this phase, so the CTAs must
 * not imply a workflow that does not exist yet.
 */
export const BillingDashboardEmptyState: FC = () => {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
      <EmptyState
        icon={Receipt}
        title="No billing activity yet"
        description="Once you create an invoice or record a payment, totals and recent activity will appear here."
        primaryAction={
          <Tooltip content="New invoice arrives in the Invoices phase">
            <Button
              variant="primary"
              disabled
              leftIcon={<Icon icon={PlusCircle} size="sm" />}
            >
              New invoice
            </Button>
          </Tooltip>
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
