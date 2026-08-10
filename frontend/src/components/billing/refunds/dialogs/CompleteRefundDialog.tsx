import type { FC } from 'react';
import { CircleCheckBig } from 'lucide-react';
import { Modal } from '../../../common/Modal/Modal';
import { Button } from '../../../common/Button/Button';
import { Icon } from '../../../common/Icon/Icon';
import { Alert } from '../../../common/Alert/Alert';
import { formatRefundAmount, formatRefundDateTime } from '../../../../utils/refundFormatting';
import type { RefundRead } from '../../../../types/billing';

interface CompleteRefundDialogProps {
  open: boolean;
  /** The refund to complete (null while closed). */
  refund: RefundRead | null;
  submitting?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * CompleteRefundDialog — confirm POST /billing/refunds/{id}/complete
 * (reference spec §17).
 *
 * Centered modal with a positive/success icon inside a pale green tile. Only
 * reachable from an Approved refund (the backend allows APPROVED → COMPLETED
 * only). Completing creates the refund allocation; a fully refunded payment
 * shows the status Refunded.
 */
export const CompleteRefundDialog: FC<CompleteRefundDialogProps> = ({
  open,
  refund,
  submitting = false,
  error = null,
  onConfirm,
  onClose,
}) => {
  return (
    <Modal open={open} onClose={onClose} size="sm" ariaLabel="Complete refund">
      <Modal.Body className="pt-6">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
            <Icon icon={CircleCheckBig} size="lg" className="text-success" />
          </div>
          <h2 className="text-h3 font-semibold text-neutral-900">Complete this refund?</h2>
          <p className="mt-2 text-body text-neutral-500">
            {refund && (
              <>
                A refund allocation of{' '}
                <span className="font-semibold text-neutral-800 tabular-nums">
                  {formatRefundAmount(refund.amount)}
                </span>{' '}
                will be created against {refund.payment.payment_number}. A fully
                refunded payment shows the status Refunded.
              </>
            )}
          </p>

          {refund && (
            <dl className="mt-5 w-full space-y-2 rounded-lg border border-success/20 bg-success/5 px-4 py-3 text-left">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-body-sm text-neutral-500">Refund</dt>
                <dd className="font-mono text-body-sm font-medium text-neutral-900">
                  {refund.refund_number}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-body-sm text-neutral-500">Amount</dt>
                <dd className="text-body-sm font-semibold text-neutral-900 tabular-nums">
                  {formatRefundAmount(refund.amount)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-body-sm text-neutral-500">Approved by</dt>
                <dd className="truncate text-body-sm font-medium text-neutral-900">
                  {refund.reviewer?.full_name ?? '—'}
                  {refund.reviewed_at ? ` · ${formatRefundDateTime(refund.reviewed_at)}` : ''}
                </dd>
              </div>
            </dl>
          )}

          {error && (
            <Alert
              variant="danger"
              className="mt-4 w-full text-left"
              title="Could not complete refund"
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
          Complete refund
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
