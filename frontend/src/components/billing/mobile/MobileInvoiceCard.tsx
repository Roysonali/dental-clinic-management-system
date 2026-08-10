import type { FC } from 'react';
import { PAYMENT_CURRENCY_CODE } from '../../../constants/billing';
import { formatISODate } from '../../../utils/date';
import { formatCurrency } from '../../../utils/formatting';
import type { InvoiceListItem } from '../../../types/billing';
import { MobileInvoiceStatusBadge } from './MobileStatusBadge';

interface MobileInvoiceCardProps {
  invoice: InvoiceListItem;
  onClick: () => void;
}

/**
 * MobileInvoiceCard — reference mobile invoice card (screen 47).
 *
 * Large white card: invoice number (or the muted italic "Draft — number
 * assigned on issue" for drafts) + status pill on the first row, patient
 * name with code · doctor on the second, divider, then "Due {date}" and the
 * INR total in the footer. The whole card is one touch target that opens
 * the invoice detail page.
 *
 * A `<button>` only accepts phrasing content, so every block region is a
 * `span` with `block`/`flex` display — valid HTML keeps native button
 * semantics (Enter/Space activation, accessible name) intact.
 */
export const MobileInvoiceCard: FC<MobileInvoiceCardProps> = ({ invoice, onClick }) => {
  const isDraft = invoice.status === 'draft';

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl border border-neutral-200 bg-white p-5 text-left shadow-sm transition-colors duration-150 hover:border-neutral-300 active:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
    >
      {/* Invoice number + status */}
      <span className="flex items-start justify-between gap-3">
        <span
          className={`min-w-0 truncate text-lg font-bold tracking-tight text-neutral-900 ${
            isDraft ? 'italic text-neutral-500' : ''
          }`}
        >
          {isDraft ? 'Draft — number assigned on issue' : invoice.invoice_number}
        </span>
        <MobileInvoiceStatusBadge status={invoice.status} />
      </span>

      {/* Patient */}
      <span className="mt-3 block truncate text-lg font-semibold text-neutral-900">
        {invoice.patient.full_name}
      </span>
      <span className="mt-0.5 block truncate text-sm text-neutral-500">
        {invoice.patient.patient_code}
        {invoice.doctor?.user_full_name ? ` · ${invoice.doctor.user_full_name}` : ''}
      </span>

      {/* Divider */}
      <span aria-hidden="true" className="mt-4 block border-t border-neutral-100" />

      {/* Footer */}
      <span className="mt-3 flex items-end justify-between gap-3">
        <span className="min-w-0 truncate text-sm text-neutral-500">
          Due {formatISODate(invoice.due_date)}
        </span>
        <span className="shrink-0 text-xl font-bold tracking-tight text-neutral-900 tabular-nums">
          {formatCurrency(invoice.financials.grand_total, PAYMENT_CURRENCY_CODE)}
        </span>
      </span>
    </button>
  );
};
