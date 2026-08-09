import type { FC } from 'react';
import { PAYMENT_CURRENCY_CODE, PAYMENT_METHOD_LABELS } from '../../../constants/billing';
import { formatISODate } from '../../../utils/date';
import { formatCurrency } from '../../../utils/formatting';
import type { PaymentListItem } from '../../../types/billing';
import { MobilePaymentStatusBadge } from './MobileStatusBadge';

interface MobilePaymentCardProps {
  payment: PaymentListItem;
  onClick: () => void;
}

/**
 * MobilePaymentCard — reference mobile payment card (screen 48).
 *
 * Large white card: payment number + status pill on the first row, patient
 * name with uppercase METHOD · date on the second, divider, then
 * "Unallocated ₹x" and the INR total in the footer. The whole card is one
 * touch target that opens the payment detail page.
 *
 * A `<button>` only accepts phrasing content, so every block region is a
 * `span` with `block`/`flex` display — valid HTML keeps native button
 * semantics (Enter/Space activation, accessible name) intact.
 */
export const MobilePaymentCard: FC<MobilePaymentCardProps> = ({ payment, onClick }) => {
  const methodLabel = PAYMENT_METHOD_LABELS[payment.payment_method] ?? payment.payment_method;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl border border-neutral-200 bg-white p-5 text-left shadow-sm transition-colors duration-150 hover:border-neutral-300 active:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
    >
      {/* Payment number + status */}
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0 truncate text-lg font-bold tracking-tight text-neutral-900">
          {payment.payment_number}
        </span>
        <MobilePaymentStatusBadge status={payment.status} />
      </span>

      {/* Patient */}
      <span className="mt-3 block truncate text-lg font-semibold text-neutral-900">
        {payment.patient.full_name}
      </span>
      <span className="mt-0.5 block truncate text-sm text-neutral-500">
        {methodLabel.toUpperCase()} · {formatISODate(payment.payment_date)}
      </span>

      {/* Divider */}
      <span aria-hidden="true" className="mt-4 block border-t border-neutral-100" />

      {/* Footer */}
      <span className="mt-3 flex items-end justify-between gap-3">
        <span className="min-w-0 truncate text-sm text-neutral-500">
          Unallocated {formatCurrency(payment.financials.unallocated_amount, PAYMENT_CURRENCY_CODE)}
        </span>
        <span className="shrink-0 text-xl font-bold tracking-tight text-neutral-900 tabular-nums">
          {formatCurrency(payment.total_amount, PAYMENT_CURRENCY_CODE)}
        </span>
      </span>
    </button>
  );
};
