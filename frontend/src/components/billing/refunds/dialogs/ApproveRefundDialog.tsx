import type { FC } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Modal } from '../../../common/Modal/Modal';
import { Button } from '../../../common/Button/Button';
import { Icon } from '../../../common/Icon/Icon';
import { Alert } from '../../../common/Alert/Alert';
import { formatRefundAmount } from '../../../../utils/refundFormatting';
import type { RefundRead } from '../../../../types/billing';

interface ApproveRefundDialogProps {
  open: boolean;
  /** The refund to approve (null while closed). */
  refund: RefundRead | null;
  submitting?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * ApproveRefundDialog — confirm POST /billing/refunds/{id}/approve
 * (reference spec §15).
 *
 * Centered modal with a positive approval icon inside a pale blue tile.
 * Only reachable from a Pending refund (the backend allows PENDING →
 * APPROVED only).
 */
export const ApproveRefundDialog: FC<ApproveRefundDialogProps> = ({
  open,
  refund,
  submitting = false,
  error = null,
  onConfirm,
  onClose,
}) => {
  return (
    <Modal open={open} onClose={onClose} size="sm" ariaLabel="Approve refund">
      <Modal.Body className="pt-6">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-50">
            <Icon icon={CheckCircle2} size="lg" className="text-primary-600" />
          </div>
          <h2 className="text-h3 font-semibold text-neutral-900">Approve this refund?</h2>
          <p className="mt-2 text-body text-neutral-500">
            {refund?.refund_number ?? 'This refund'} moves to approved. It still
            needs to be completed before the refund allocation is created.
          </p>

          {refund && (
            <dl className="mt-5 w-full space-y-2 rounded-lg border border-neutral-200 bg-neutral-50/60 px-4 py-3 text-left">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-body-sm text-neutral-500">Payment</dt>
                <dd className="font-mono text-body-sm font-medium text-neutral-900">
                  {refund.payment.payment_number}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-body-sm text-neutral-500">Refund amount</dt>
                <dd className="text-body-sm font-semibold text-neutral-900 tabular-nums">
                  {formatRefundAmount(refund.amount)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-body-sm text-neutral-500">Requested by</dt>
                <dd className="truncate text-body-sm font-medium text-neutral-900">
                  {refund.creator?.full_name ?? `User #${refund.created_by}`}
                </dd>
              </div>
            </dl>
          )}

          {error && (
            <Alert
              variant="danger"
              className="mt-4 w-full text-left"
              title="Could not approve refund"
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
          Approve refund
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
