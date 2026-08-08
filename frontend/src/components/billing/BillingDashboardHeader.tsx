import type { FC } from 'react';
import { PlusCircle, CreditCard } from 'lucide-react';
import { PageHeader } from '../common/PageHeader/PageHeader';
import { Button } from '../common/Button/Button';
import { Tooltip } from '../common/Tooltip/Tooltip';
import { Icon } from '../common/Icon/Icon';

/**
 * BillingDashboardHeader — page header for the Billing Dashboard.
 *
 * Quick actions ("Record payment", "New invoice") are dashboard shortcuts
 * ONLY. The Invoice and Payment workflows are not part of this phase, so the
 * buttons render disabled with explanatory tooltips rather than navigating to
 * non-existent routes or faking functionality. Once those phases ship routes,
 * these CTAs can be wired and gated through the existing PermissionGate.
 *
 * Note: a second notification bell is intentionally NOT rendered here — the
 * application's global header (HeaderRight) already provides notifications.
 */
const RECORD_PAYMENT_HINT_ID = 'billing-record-payment-hint';
const NEW_INVOICE_HINT_ID = 'billing-new-invoice-hint';

const RECORD_PAYMENT_HINT = 'Record payment arrives in the Payments phase';
const NEW_INVOICE_HINT = 'New invoice arrives in the Invoices phase';

export const BillingDashboardHeader: FC = () => {
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
          <Tooltip content={NEW_INVOICE_HINT}>
            <Button
              variant="primary"
              disabled
              aria-describedby={NEW_INVOICE_HINT_ID}
              leftIcon={<Icon icon={PlusCircle} size="sm" />}
            >
              New invoice
            </Button>
          </Tooltip>
          {/*
            Visually hidden explanation wired via aria-describedby. A natively
            disabled button cannot receive focus, so the hover/focus Tooltip
            is unreachable by keyboard — this sr-only text keeps the reason
            discoverable to screen readers (same pattern as form field hints).
          */}
          <span id={RECORD_PAYMENT_HINT_ID} className="sr-only">
            {RECORD_PAYMENT_HINT} — this workflow is not available yet.
          </span>
          <span id={NEW_INVOICE_HINT_ID} className="sr-only">
            {NEW_INVOICE_HINT} — this workflow is not available yet.
          </span>
        </>
      }
    />
  );
};
