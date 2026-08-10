import { useState, type FC } from 'react';
import { Ban } from 'lucide-react';
import { Modal } from '../../../common/Modal/Modal';
import { Button } from '../../../common/Button/Button';
import { Icon } from '../../../common/Icon/Icon';
import { Alert } from '../../../common/Alert/Alert';
import { Textarea } from '../../../common/Input';
import { REFUND_REJECTION_REASON_MAX_LENGTH } from '../../../../constants/billing';
import type { RefundRead } from '../../../../types/billing';

interface RejectRefundDialogProps {
  open: boolean;
  /** The refund to reject (null while closed). */
  refund: RefundRead | null;
  submitting?: boolean;
  error?: string | null;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

/**
 * RejectRefundDialog — confirm POST /billing/refunds/{id}/reject
 * (reference spec §16).
 *
 * Destructive dialog: pale red icon tile, danger CTA. A rejection reason is
 * REQUIRED by the backend validator, so the confirm button stays disabled
 * until a non-empty reason is entered (max length mirrors the backend
 * `RefundWorkflowRequest.reason` limit of 500). Only reachable from a
 * Pending refund.
 */
export const RejectRefundDialog: FC<RejectRefundDialogProps> = ({
  open,
  refund,
  submitting = false,
  error = null,
  onConfirm,
  onClose,
}) => {
  const [reason, setReason] = useState('');
  const hasReason = reason.trim().length > 0;

  return (
    <Modal open={open} onClose={onClose} size="sm" ariaLabel="Reject refund">
      <Modal.Body className="pt-6">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-danger/10">
            <Icon icon={Ban} size="lg" className="text-danger" />
          </div>
          <h2 className="text-h3 font-semibold text-neutral-900">Reject this refund?</h2>
          <p className="mt-2 text-body text-neutral-500">
            {refund?.refund_number ?? 'This refund'} will be rejected and no
            money moves. The reason is stored on the refund's audit trail.
          </p>

          <div className="mt-5 w-full text-left">
            <Textarea
              label="Reason"
              required
              placeholder="Why is this refund being rejected?"
              maxLength={REFUND_REJECTION_REASON_MAX_LENGTH}
              showCharCount
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              aria-describedby="reject-refund-hint"
            />
            <p id="reject-refund-hint" className="mt-1 text-caption text-neutral-400">
              Confirm is enabled once a reason is entered.
            </p>
          </div>

          {error && (
            <Alert
              variant="danger"
              className="mt-4 w-full text-left"
              title="Could not reject refund"
              description={error}
            />
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
          disabled={submitting || !hasReason}
        >
          Reject refund
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
