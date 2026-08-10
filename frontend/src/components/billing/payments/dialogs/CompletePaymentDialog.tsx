import type { FC } from 'react';
import { CircleCheck } from 'lucide-react';
import { Modal } from '../../../common/Modal/Modal';
import { Button } from '../../../common/Button/Button';
import { Icon } from '../../../common/Icon/Icon';
import { Alert } from '../../../common/Alert/Alert';
import { PAYMENT_CURRENCY_CODE, PAYMENT_METHOD_LABELS } from '../../../../constants/billing';
import { formatCurrency } from '../../../../utils/formatting';
import type { PaymentListItem, PaymentRead } from '../../../../types/billing';

/** A list row or the full aggregate — both carry the fields we display. */
export type DialogPayment = PaymentListItem | PaymentRead;

interface CompletePaymentDialogProps {
  open: boolean;
  /** The payment to complete (null while closed). */
  payment: DialogPayment | null;
  submitting?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * CompletePaymentDialog — confirm POST /billing/payments/{id}/complete.
 *
 * The backend transition table allows Pending → Completed only, so this
 * dialog is only reachable from a Pending payment. The confirm button is the
 * primary (blue) action — completing is not destructive. Disabled while a
 * request is in flight (no duplicate transitions).
 */
export const CompletePaymentDialog: FC<CompletePaymentDialogProps> = ({
  open,
  payment,
  submitting = false,
  error = null,
  onConfirm,
  onClose,
}) => {
  const currency = PAYMENT_CURRENCY_CODE;

  return (
    <Modal open={open} onClose={onClose} size="sm" ariaLabel="Complete payment">
      <Modal.Body className="pt-6">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
            <Icon icon={CircleCheck} size="lg" className="text-success" />
          </div>
          <h2 className="text-h3 font-semibold text-neutral-900">Complete this payment?</h2>
          <p className="mt-2 text-body text-neutral-500">
            {payment?.payment_number ?? 'This payment'} will be marked completed.
            Completed payments can be allocated to invoices and can have a
            receipt generated.
          </p>

          {payment && (
            <dl className="mt-5 w-full space-y-2 rounded-lg border border-neutral-200 bg-neutral-50/60 px-4 py-3 text-left">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-body-sm text-neutral-500">Patient</dt>
                <dd className="truncate text-body-sm font-medium text-neutral-900">
                  {payment.patient.full_name}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-body-sm text-neutral-500">Method</dt>
                <dd className="text-body-sm font-medium text-neutral-900">
                  {PAYMENT_METHOD_LABELS[payment.payment_method]}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-body-sm text-neutral-500">Total amount</dt>
                <dd className="text-body-sm font-semibold text-neutral-900 tabular-nums">
                  {formatCurrency(payment.total_amount, currency)}
                </dd>
              </div>
            </dl>
          )}

          {error && (
            <Alert variant="danger" className="mt-4 w-full text-left" title="Could not complete payment" description={error} />
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button variant="primary" onClick={onConfirm} loading={submitting} disabled={submitting}>
          Complete payment
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
