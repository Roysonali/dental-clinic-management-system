import type { FC } from 'react';
import { Card } from '../../common/Card/Card';
import { PAYMENT_CURRENCY_CODE } from '../../../constants/billing';
import { formatCurrency } from '../../../utils/formatting';
import type { PaymentFinancialSummary } from '../../../types/billing';

interface PaymentFinancialSummaryCardProps {
  financials: PaymentFinancialSummary;
}

/**
 * PaymentFinancialSummaryCard — right-side FINANCIAL SUMMARY card
 * (reference spec §28). Rows come verbatim from the backend aggregate
 * (`PaymentFinancialSummary`); no client-side calculation. The final
 * Unallocated value is visually emphasised.
 */
export const PaymentFinancialSummaryCard: FC<PaymentFinancialSummaryCardProps> = ({
  financials,
}) => {
  return (
    <Card>
      <Card.Body>
        <h3 className="text-h4 font-semibold text-neutral-900">Financial Summary</h3>
        <dl className="mt-4 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-body-sm text-neutral-500">Total amount</dt>
            <dd className="text-body-sm font-medium text-neutral-800 tabular-nums">
              {formatCurrency(financials.total_amount, PAYMENT_CURRENCY_CODE)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-body-sm text-neutral-500">Allocated</dt>
            <dd className="text-body-sm text-neutral-800 tabular-nums">
              {formatCurrency(financials.allocated_amount, PAYMENT_CURRENCY_CODE)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-body-sm text-neutral-500">Refunded</dt>
            <dd className="text-body-sm text-neutral-800 tabular-nums">
              {formatCurrency(financials.refunded_amount, PAYMENT_CURRENCY_CODE)}
            </dd>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 border-t border-neutral-100 pt-3">
            <dt className="text-body font-semibold text-neutral-900">Unallocated</dt>
            <dd className="text-h4 font-bold text-primary-700 tabular-nums">
              {formatCurrency(financials.unallocated_amount, PAYMENT_CURRENCY_CODE)}
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
