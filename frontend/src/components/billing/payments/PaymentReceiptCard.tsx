import type { FC } from 'react';
import { Receipt } from 'lucide-react';
import { Card } from '../../common/Card/Card';
import { Button } from '../../common/Button/Button';
import { Icon } from '../../common/Icon/Icon';
import { StatusBadge } from '../../common/StatusBadge/StatusBadge';
import { Alert } from '../../common/Alert/Alert';
import { PAYMENT_CURRENCY_CODE, RECEIPT_STATUS_VARIANTS } from '../../../constants/billing';
import { formatCurrency } from '../../../utils/formatting';
import { formatISODate } from '../../../utils/date';
import type { ReceiptRead } from '../../../types/billing';

interface PaymentReceiptCardProps {
  /** The generated receipt (null until generated in this session). */
  receipt: ReceiptRead | null;
  /** True when the payment is completed (the only generate-eligible state). */
  canGenerate: boolean;
  generating?: boolean;
  error?: string | null;
  onGenerate: () => void;
}

/**
 * PaymentReceiptCard — RECEIPT card on the payment detail page
 * (reference spec §29).
 *
 * The backend generates a receipt for a COMPLETED payment
 * (POST /billing/receipts) but exposes no lookup-by-payment endpoint, so the
 * card shows the receipt generated in this session (cached from the mutation
 * response) and offers "Generate receipt" when the payment is completed.
 * No fake receipt state is ever rendered — values come from the real
 * `ReceiptRead` returned by the endpoint.
 */
export const PaymentReceiptCard: FC<PaymentReceiptCardProps> = ({
  receipt,
  canGenerate,
  generating = false,
  error = null,
  onGenerate,
}) => {
  return (
    <Card>
      <Card.Body>
        <h3 className="text-h4 font-semibold text-neutral-900">Receipt</h3>

        {receipt ? (
          <dl className="mt-4 space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-body-sm text-neutral-500">Receipt</dt>
              <dd className="font-mono text-body-sm font-medium text-neutral-900">
                {receipt.receipt_number}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-body-sm text-neutral-500">Status</dt>
              <dd>
                <StatusBadge status={receipt.status} statusMap={RECEIPT_STATUS_VARIANTS} size="sm" />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-body-sm text-neutral-500">Amount</dt>
              <dd className="text-body-sm font-semibold text-neutral-900 tabular-nums">
                {formatCurrency(receipt.amount, PAYMENT_CURRENCY_CODE)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-body-sm text-neutral-500">Date</dt>
              <dd className="text-body-sm font-medium text-neutral-800">
                {formatISODate(receipt.receipt_date)}
              </dd>
            </div>
          </dl>
        ) : (
          <div className="mt-4 flex flex-col items-start gap-3">
            <p className="flex items-start gap-2 text-body-sm text-neutral-500">
              <Icon icon={Receipt} size="sm" className="mt-0.5 shrink-0 text-neutral-400" />
              {canGenerate
                ? 'No receipt generated yet. Generate one to acknowledge this payment.'
                : 'Receipts can be generated once the payment is completed.'}
            </p>
            {canGenerate && (
              <Button variant="secondary" size="sm" onClick={onGenerate} loading={generating} disabled={generating}>
                Generate receipt
              </Button>
            )}
          </div>
        )}

        {error && (
          <Alert
            variant="danger"
            className="mt-4"
            title="Could not generate receipt"
            description={error}
          />
        )}
      </Card.Body>
    </Card>
  );
};
