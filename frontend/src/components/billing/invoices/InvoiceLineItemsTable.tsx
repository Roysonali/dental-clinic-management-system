import type { FC } from 'react';
import { PAYMENT_CURRENCY_CODE } from '../../../constants/billing';
import { formatCurrency } from '../../../utils/formatting';
import type { InvoiceItemSummary } from '../../../types/billing';

interface InvoiceLineItemsTableProps {
  items: InvoiceItemSummary[];
}

/**
 * InvoiceLineItemsTable — structured line-item table for the invoice detail.
 *
 * Financial values come verbatim from the backend aggregate (never
 * recomputed client-side). Discount renders the backend `discount_value`
 * with its type label (e.g. "10.00 · Percentage"). Amounts are right-aligned
 * and use the shared currency formatter.
 */
export const InvoiceLineItemsTable: FC<InvoiceLineItemsTableProps> = ({ items }) => {
  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
      <table className="w-full border-collapse text-left" aria-label="Line items">
        <thead>
          <tr className="border-b border-neutral-200 bg-neutral-50">
            <th scope="col" className="w-12 px-5 py-3.5 text-label font-semibold text-neutral-600">#</th>
            <th scope="col" className="px-5 py-3.5 text-label font-semibold text-neutral-600">Description</th>
            <th scope="col" className="px-5 py-3.5 text-right text-label font-semibold text-neutral-600">Qty</th>
            <th scope="col" className="px-5 py-3.5 text-right text-label font-semibold text-neutral-600">Unit Price</th>
            <th scope="col" className="px-5 py-3.5 text-right text-label font-semibold text-neutral-600">Discount</th>
            <th scope="col" className="px-5 py-3.5 text-right text-label font-semibold text-neutral-600">Net Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/60">
              <td className="px-5 py-4 text-body-sm text-neutral-400 tabular-nums">
                {item.sequence_number}
              </td>
              <td className="px-5 py-4 text-body text-neutral-800">{item.description}</td>
              <td className="px-5 py-4 text-right text-body text-neutral-800 tabular-nums">
                {item.quantity}
              </td>
              <td className="px-5 py-4 text-right text-body text-neutral-800 tabular-nums">
                {formatCurrency(item.unit_price, PAYMENT_CURRENCY_CODE)}
              </td>
              <td className="px-5 py-4 text-right text-body text-neutral-600 tabular-nums">
                {item.discount_value !== null && item.discount_type ? (
                  <>
                    {formatCurrency(item.discount_value, PAYMENT_CURRENCY_CODE)}
                    <span className="ml-1 text-caption text-neutral-400">
                      · {item.discount_type === 'PERCENTAGE' ? 'Percentage' : 'Fixed'}
                    </span>
                  </>
                ) : (
                  '—'
                )}
              </td>
              <td className="px-5 py-4 text-right text-body font-medium text-neutral-900 tabular-nums">
                {formatCurrency(item.net_amount, PAYMENT_CURRENCY_CODE)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
