import type { FC } from 'react';
import { Card } from '../../common/Card/Card';
import { PAYMENT_CURRENCY_CODE } from '../../../constants/billing';
import { formatCurrency } from '../../../utils/formatting';
import type { InvoiceFinancialSummary } from '../../../types/billing';

interface InvoiceFinancialSummaryCardProps {
  financials: InvoiceFinancialSummary;
}

/**
 * InvoiceFinancialSummaryCard — right-side financial summary for the detail.
 *
 * Shows subtotal / discount / tax / grand total + currency, all taken
 * verbatim from the backend aggregate (no client-side recalculation). Tax is
 * only rendered when the backend provides a tax total. Grand total gets the
 * strongest visual hierarchy.
 *
 * Amounts present in INR (`PAYMENT_CURRENCY_CODE`) — the Billing-wide
 * presentation currency — matching the dashboard and Payments module.
 * Amounts themselves remain the backend's.
 */
export const InvoiceFinancialSummaryCard: FC<InvoiceFinancialSummaryCardProps> = ({
  financials,
}) => {
  return (
    <Card>
      <Card.Body>
        <h3 className="text-h4 font-semibold text-neutral-900">Financial Summary</h3>
        <dl className="mt-4 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-body-sm text-neutral-500">Subtotal</dt>
            <dd className="text-body-sm text-neutral-800 tabular-nums">
              {formatCurrency(financials.subtotal, PAYMENT_CURRENCY_CODE)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-body-sm text-neutral-500">Discount total</dt>
            <dd className="text-body-sm text-neutral-800 tabular-nums">
              {formatCurrency(financials.discount_total, PAYMENT_CURRENCY_CODE)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-body-sm text-neutral-500">Tax total</dt>
            <dd className="text-body-sm text-neutral-800 tabular-nums">
              {formatCurrency(financials.tax_total, PAYMENT_CURRENCY_CODE)}
            </dd>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 border-t border-neutral-100 pt-3">
            <dt className="text-body font-semibold text-neutral-900">Grand total</dt>
            <dd className="text-h4 font-bold text-neutral-900 tabular-nums">
              {formatCurrency(financials.grand_total, PAYMENT_CURRENCY_CODE)}
            </dd>
          </div>
        </dl>
        <p className="mt-3 flex items-center justify-between text-caption text-neutral-400">
          <span>Currency</span>
          <span className="font-medium">{PAYMENT_CURRENCY_CODE}</span>
        </p>
      </Card.Body>
    </Card>
  );
};
