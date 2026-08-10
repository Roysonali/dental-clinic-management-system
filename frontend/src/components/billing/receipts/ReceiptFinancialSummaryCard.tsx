import type { FC } from 'react';
import { Card } from '../../common/Card/Card';
import { formatReceiptAmount } from '../../../utils/receiptFormatting';
import { PAYMENT_CURRENCY_CODE } from '../../../constants/billing';
import type { ReceiptRead } from '../../../types/billing';

interface ReceiptFinancialSummaryCardProps {
  receipt: ReceiptRead;
}

/**
 * ReceiptFinancialSummaryCard — right-side FINANCIAL SUMMARY card
 * (reference spec §7). The payment total comes from the linked payment
 * summary; the receipt amount is the final emphasized figure.
 *
 * Amounts present in INR (`PAYMENT_CURRENCY_CODE`) — the Billing-wide
 * presentation currency, exactly like every other Billing surface
 * (Payments, Dashboard, Invoices). The backend stays the financial
 * authority; this card simply renders the same uniform ₹ display.
 */
export const ReceiptFinancialSummaryCard: FC<ReceiptFinancialSummaryCardProps> = ({ receipt }) => {
  return (
    <Card>
      <Card.Body>
        <h3 className="text-h4 font-semibold text-neutral-900">Financial Summary</h3>
        <dl className="mt-4 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-body-sm text-neutral-500">Payment total</dt>
            <dd className="text-body-sm font-medium text-neutral-800 tabular-nums">
              {formatReceiptAmount(receipt.payment.total_amount)}
            </dd>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 border-t border-neutral-100 pt-3">
            <dt className="text-body font-semibold text-neutral-900">Receipt amount</dt>
            <dd className="text-h4 font-bold text-primary-700 tabular-nums">
              {formatReceiptAmount(receipt.amount)}
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
