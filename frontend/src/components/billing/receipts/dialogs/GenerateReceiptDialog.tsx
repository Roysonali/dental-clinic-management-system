import type { FC } from 'react';
import { Receipt } from 'lucide-react';
import { Modal } from '../../../common/Modal/Modal';
import { Button } from '../../../common/Button/Button';
import { Icon } from '../../../common/Icon/Icon';
import { Alert } from '../../../common/Alert/Alert';
import { PAYMENT_METHOD_LABELS } from '../../../../constants/billing';
import { formatCurrency } from '../../../../utils/formatting';
import { formatISODate } from '../../../../utils/date';
import { todayLocalISO } from '../../../../utils/date';
import { PAYMENT_CURRENCY_CODE } from '../../../../constants/billing';
import type { DialogPayment } from '../../payments/dialogs/CompletePaymentDialog';

interface GenerateReceiptDialogProps {
  open: boolean;
  /** The completed payment to acknowledge (null while closed). */
  payment: DialogPayment | null;
  submitting?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * GenerateReceiptDialog — confirm POST /billing/receipts (reference spec §12).
 *
 * Centered modal over the payment detail page (no navigation away). The
 * payment is fixed by context — the backend assigns the sequential receipt
 * number, amount (= payment total) and date (= today), so the summary box
 * is informational only. Confirm is the primary (blue) action.
 */
export const GenerateReceiptDialog: FC<GenerateReceiptDialogProps> = ({
  open,
  payment,
  submitting = false,
  error = null,
  onConfirm,
  onClose,
}) => {
  const today = formatISODate(todayLocalISO());

  return (
    <Modal open={open} onClose={onClose} size="sm" ariaLabel="Generate receipt">
      <Modal.Body className="pt-6">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-50">
            <Icon icon={Receipt} size="lg" className="text-primary-600" />
          </div>
          <h2 className="text-h3 font-semibold text-neutral-900">Generate receipt?</h2>
          <p className="mt-2 text-body text-neutral-500">
            A receipt (RCT-#####) will be created for this completed payment.
            The amount equals the payment total and the receipt date is today.
          </p>

          {payment && (
            <div className="mt-5 w-full text-left">
              <label
                htmlFor="generate-receipt-payment"
                className="mb-1.5 block text-caption font-medium uppercase tracking-wide text-neutral-500"
              >
                Payment <span className="text-danger">*</span>
              </label>
              <select
                id="generate-receipt-payment"
                className="w-full cursor-not-allowed rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-body text-neutral-600"
                value={payment.id}
                disabled
                aria-label="Payment"
              >
                <option value={payment.id}>
                  {payment.payment_number} · {payment.patient.full_name} ·{' '}
                  {formatCurrency(payment.total_amount, PAYMENT_CURRENCY_CODE)}
                </option>
              </select>
            </div>
          )}

          {payment && (
            <dl className="mt-4 w-full space-y-2 rounded-lg border border-primary-100 bg-primary-50/60 px-4 py-3 text-left">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-body-sm text-neutral-500">Receipt amount</dt>
                <dd className="text-body-sm font-semibold text-neutral-900 tabular-nums">
                  {formatCurrency(payment.total_amount, PAYMENT_CURRENCY_CODE)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-body-sm text-neutral-500">Receipt date</dt>
                <dd className="text-body-sm font-medium text-neutral-900">
                  Today · {today}
                </dd>
              </div>
              <p className="border-t border-primary-100 pt-2 text-caption text-neutral-400">
                Method · {PAYMENT_METHOD_LABELS[payment.payment_method]}
              </p>
            </dl>
          )}

          {error && (
            <Alert
              variant="danger"
              className="mt-4 w-full text-left"
              title="Could not generate receipt"
              description={error}
            />
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button variant="primary" onClick={onConfirm} loading={submitting} disabled={submitting}>
          Generate receipt
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
