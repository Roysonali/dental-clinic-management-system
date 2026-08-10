import { useState, type FC } from 'react';
import { Ban } from 'lucide-react';
import { Modal } from '../../../common/Modal/Modal';
import { Button } from '../../../common/Button/Button';
import { Icon } from '../../../common/Icon/Icon';
import { Alert } from '../../../common/Alert/Alert';
import { Textarea } from '../../../common/Input';
import { PAYMENT_REASON_MAX_LENGTH } from '../../../../constants/billing';
import type { DialogPayment } from './CompletePaymentDialog';

interface VoidPaymentDialogProps {
  open: boolean;
  /** The payment to void (null while closed). */
  payment: DialogPayment | null;
  submitting?: boolean;
  error?: string | null;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

/**
 * VoidPaymentDialog — confirm POST /billing/payments/{id}/void.
 *
 * Void is a terminal state (backend `PAYMENT_TRANSITIONS`): voided payments
 * remain on the record but cannot be allocated or refunded. The optional
 * reason (<= 500) is recorded on the audit trail. The void action is
 * destructive (red).
 */
export const VoidPaymentDialog: FC<VoidPaymentDialogProps> = ({
  open,
  payment,
  submitting = false,
  error = null,
  onConfirm,
  onClose,
}) => {
  const [reason, setReason] = useState('');

  return (
    <Modal open={open} onClose={onClose} size="sm" ariaLabel="Void payment">
      <Modal.Body className="pt-6">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100">
            <Icon icon={Ban} size="lg" className="text-neutral-500" />
          </div>
          <h2 className="text-h3 font-semibold text-neutral-900">Void this payment?</h2>
          <p className="mt-2 text-body text-neutral-500">
            {payment?.payment_number ?? 'This payment'} will be voided. Voided
            payments remain on the record but are not treated as active — they
            cannot be completed, allocated, or refunded.
          </p>

          <div className="mt-5 w-full text-left">
            <Textarea
              label="Reason"
              placeholder="e.g. Entered against the wrong patient"
              maxLength={PAYMENT_REASON_MAX_LENGTH}
              showCharCount
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {error && (
            <Alert variant="danger" className="mt-4 w-full text-left" title="Could not void payment" description={error} />
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
          Void payment
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
