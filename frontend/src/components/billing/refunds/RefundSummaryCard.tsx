import type { FC } from 'react';
import { Card } from '../../common/Card/Card';
import { formatRefundAmount } from '../../../utils/refundFormatting';
import type { PaymentRead, RefundRead } from '../../../types/billing';

interface RefundSummaryCardProps {
  refund: RefundRead;
  /** The linked payment aggregate (optional — carries the completed-refunds
   *  total for the "Previously refunded" row). */
  payment?: PaymentRead | null;
}

/**
 * RefundSummaryCard — right-column REFUND SUMMARY card (reference spec §20).
 *
 * Payment total and this refund come from the refund aggregate; "Previously
 * refunded" comes from the linked payment's financials (completed refunds)
 * when the payment is available — the refund aggregate carries no such
 * figure — and degrades to "—" otherwise. "This refund" is emphasized.
 */
export const RefundSummaryCard: FC<RefundSummaryCardProps> = ({ refund, payment }) => {
  const paymentTotal = refund.financials.payment_total ?? refund.payment.total_amount;
  const previouslyRefunded = payment ? payment.financials.refunded_amount : null;

  return (
    <Card>
      <Card.Header title="Refund Summary" />
      <Card.Body>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-caption font-medium uppercase tracking-wide text-neutral-500">Payment total</span>
            <span className="text-body-sm font-medium text-neutral-800 tabular-nums">
              {formatRefundAmount(paymentTotal)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-caption font-medium uppercase tracking-wide text-neutral-500">Previously refunded</span>
            <span className="text-body-sm text-neutral-800 tabular-nums">
              {previouslyRefunded != null
                ? formatRefundAmount(previouslyRefunded)
                : '—'}
            </span>
          </div>
          <div className="border-t border-neutral-100" />
          <div className="flex items-center justify-between gap-3">
            <span className="text-body-sm font-semibold text-neutral-900">This refund</span>
            <span className="text-h4 font-bold text-primary-700 tabular-nums">
              {formatRefundAmount(refund.amount)}
            </span>
          </div>
        </div>
      </Card.Body>
    </Card>
  );
};
