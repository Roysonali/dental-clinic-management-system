import type { FC } from 'react';
import { Card } from '../../common/Card/Card';
import { StatusBadge } from '../../common/StatusBadge/StatusBadge';
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_VARIANTS } from '../../../constants/billing';
import { formatReceiptAmount, formatReceiptDate } from '../../../utils/receiptFormatting';
import type { PaymentStatus, ReceiptRead } from '../../../types/billing';

interface LinkedPaymentCardProps {
  receipt: ReceiptRead;
  /** The linked payment aggregate (fetched for its status — the receipt's
   *  payment summary does not carry it). Null while loading/failed. */
  paymentStatus: PaymentStatus | null;
}

/**
 * LinkedPaymentCard — table-like card showing the payment this receipt
 * acknowledges (reference spec §8): payment number, method, payment date,
 * status, total. The status badge comes from the real linked payment
 * aggregate via the shared StatusBadge infrastructure — never a fake badge.
 */
export const LinkedPaymentCard: FC<LinkedPaymentCardProps> = ({ receipt, paymentStatus }) => {
  const payment = receipt.payment;

  return (
    <Card>
      <Card.Header title="Linked Payment" />
      <Card.Body>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left" aria-label="Linked payment">
            <thead>
              <tr className="border-b border-neutral-200">
                {['Payment number', 'Method', 'Payment date', 'Status', 'Total'].map((heading) => (
                  <th
                    key={heading}
                    scope="col"
                    className="pb-2 pr-4 text-caption font-medium uppercase tracking-wide text-neutral-500"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-neutral-100 last:border-b-0">
                <td className="py-3 pr-4 font-mono text-body-sm font-medium text-neutral-900">
                  {payment.payment_number}
                </td>
                <td className="py-3 pr-4 text-body-sm text-neutral-700">
                  {PAYMENT_METHOD_LABELS[payment.payment_method as keyof typeof PAYMENT_METHOD_LABELS] ?? payment.payment_method}
                </td>
                <td className="py-3 pr-4 text-body-sm text-neutral-700">
                  {formatReceiptDate(payment.payment_date)}
                </td>
                <td className="py-3 pr-4">
                  {paymentStatus ? (
                    <StatusBadge status={paymentStatus} statusMap={PAYMENT_STATUS_VARIANTS} size="sm" />
                  ) : (
                    <span className="text-body-sm text-neutral-400">—</span>
                  )}
                </td>
                <td className="py-3 text-body-sm font-semibold text-neutral-900 tabular-nums">
                  {formatReceiptAmount(payment.total_amount)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card.Body>
    </Card>
  );
};
