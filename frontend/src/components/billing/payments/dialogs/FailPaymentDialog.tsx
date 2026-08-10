import { useState, type FC } from 'react';
import { CircleX } from 'lucide-react';
import { Modal } from '../../../common/Modal/Modal';
import { Button } from '../../../common/Button/Button';
import { Icon } from '../../../common/Icon/Icon';
import { Alert } from '../../../common/Alert/Alert';
import { Textarea } from '../../../common/Input';
import { PAYMENT_REASON_MAX_LENGTH } from '../../../../constants/billing';
import type { DialogPayment } from './CompletePaymentDialog';

interface FailPaymentDialogProps {
  open: boolean;
  /** The payment to fail (null while closed). */
  payment: DialogPayment | null;
  submitting?: boolean;
  error?: string | null;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

/**
 * FailPaymentDialog — confirm POST /billing/payments/{id}/fail.
 *
 * An optional reason (<= 500) is recorded on the backend audit trail. The
 * confirm action is destructive (red) — only the CTA and the error icon use
 * danger styling, per the DensCare modal conventions. Disabled while a
 * request is in flight.
 */
export const FailPaymentDialog: FC<FailPaymentDialogProps> = ({
  open,
  payment,
  submitting = false,
  error = null,
  onConfirm,
  onClose,
}) => {
  const [reason, setReason] = useState('');

  return (
    <Modal open={open} onClose={onClose} size="sm" ariaLabel="Mark payment as failed">
      <Modal.Body className="pt-6">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-danger/10">
            <Icon icon={CircleX} size="lg" className="text-danger" />
          </div>
          <h2 className="text-h3 font-semibold text-neutral-900">Mark this payment as failed?</h2>
          <p className="mt-2 text-body text-neutral-500">
            {payment?.payment_number ?? 'This payment'} will be marked failed.
            A failed payment cannot be completed or allocated to invoices. The
            reason is recorded on the audit trail.
          </p>

          <div className="mt-5 w-full text-left">
            <Textarea
              label="Reason"
              placeholder="Optional — why did this payment fail?"
              maxLength={PAYMENT_REASON_MAX_LENGTH}
              showCharCount
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {error && (
            <Alert variant="danger" className="mt-4 w-full text-left" title="Could not mark payment as failed" description={error} />
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="danger"
          onClick={() => onConfirm(reason.trim())}
          loading={submitting}
          disabled={submitting}
        >
          Mark as failed
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
