import type { FC } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Modal } from '../../../common/Modal/Modal';
import { Button } from '../../../common/Button/Button';
import { Icon } from '../../../common/Icon/Icon';
import { Alert } from '../../../common/Alert/Alert';
import { PAYMENT_CURRENCY_CODE, PAYMENT_METHOD_LABELS } from '../../../../constants/billing';
import { formatCurrency } from '../../../../utils/formatting';
import type { DialogPayment } from './CompletePaymentDialog';

interface DeletePaymentDialogProps {
  open: boolean;
  /** The pending payment to delete (null while closed). */
  payment: DialogPayment | null;
  submitting?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * DeletePaymentDialog — destructive delete-pending confirmation
 * (DELETE /billing/payments/{id}).
 *
 * The backend performs a HARD delete, only for Pending payments, and the
 * endpoint is ADMIN-only (`_PAYMENT_DELETE_ROLES`) — the action is gated
 * client-side via PermissionGate wherever it appears. Role names are NOT
 * hardcoded here (the client cannot resolve non-admin roles; the backend is
 * the authority). The delete action is destructive (red).
 */
export const DeletePaymentDialog: FC<DeletePaymentDialogProps> = ({
  open,
  payment,
  submitting = false,
  error = null,
  onConfirm,
  onClose,
}) => {
  const currency = PAYMENT_CURRENCY_CODE;

  return (
    <Modal open={open} onClose={onClose} size="sm" ariaLabel="Delete payment">
      <Modal.Body className="pt-6">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-danger/10">
            <Icon icon={TriangleAlert} size="lg" className="text-danger" />
          </div>
          <h2 className="text-h3 font-semibold text-neutral-900">Delete this pending payment?</h2>
          <p className="mt-2 text-body text-neutral-500">
            This permanently removes {payment?.payment_number ?? 'this payment'}.
            Only pending payments can be deleted, and this action requires the
            appropriate permissions. This cannot be undone.
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
            <Alert variant="danger" className="mt-4 w-full text-left" title="Could not delete payment" description={error} />
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={submitting} disabled={submitting}>
          Delete payment
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
