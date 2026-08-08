import type { FC } from 'react';
import { Unlink } from 'lucide-react';
import { Modal } from '../../../common/Modal/Modal';
import { Button } from '../../../common/Button/Button';
import { Icon } from '../../../common/Icon/Icon';
import { Alert } from '../../../common/Alert/Alert';
import { PAYMENT_CURRENCY_CODE } from '../../../../constants/billing';
import { formatCurrency } from '../../../../utils/formatting';
import type { PaymentAllocationSummary } from '../../../../types/billing';
import type { DialogPayment } from './CompletePaymentDialog';

interface DeallocatePaymentDialogProps {
  open: boolean;
  /** The payment the allocation belongs to (null while closed). */
  payment: DialogPayment | null;
  /** The allocation to remove (null while closed). */
  allocation: PaymentAllocationSummary | null;
  submitting?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * DeallocatePaymentDialog — confirm POST /billing/payments/{id}/deallocate.
 *
 * The backend returns the allocation amount to the payment's unallocated
 * balance (and back onto the invoice's outstanding balance). The "new
 * unallocated balance" row is a presentation of backend values
 * (unallocated + allocation amount) — the backend recomputes authoritatively
 * on the next read. The remove action is destructive (red).
 */
export const DeallocatePaymentDialog: FC<DeallocatePaymentDialogProps> = ({
  open,
  payment,
  allocation,
  submitting = false,
  error = null,
  onConfirm,
  onClose,
}) => {
  const currency = PAYMENT_CURRENCY_CODE;
  const allocated = Number(allocation?.allocated_amount ?? 0);
  const currentUnallocated = Number(payment?.financials?.unallocated_amount ?? 0);
  const newUnallocated = Math.max(0, currentUnallocated + allocated);

  return (
    <Modal open={open} onClose={onClose} size="sm" ariaLabel="Remove allocation">
      <Modal.Body className="pt-6">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-danger/10">
            <Icon icon={Unlink} size="lg" className="text-danger" />
          </div>
          <h2 className="text-h3 font-semibold text-neutral-900">Remove this allocation?</h2>
          <p className="mt-2 text-body text-neutral-500">
            The allocated amount will return to the payment's unallocated
            balance and back onto the invoice's outstanding balance.
          </p>

          {allocation?.invoice && (
            <dl className="mt-5 w-full space-y-2 rounded-lg border border-neutral-200 bg-neutral-50/60 px-4 py-3 text-left">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-body-sm text-neutral-500">Invoice</dt>
                <dd className="font-mono text-body-sm font-medium text-neutral-900">
                  {allocation.invoice.invoice_number}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-body-sm text-neutral-500">Allocated amount</dt>
                <dd className="text-body-sm font-medium text-neutral-900 tabular-nums">
                  {formatCurrency(allocation.allocated_amount, currency)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-neutral-200 pt-2">
                <dt className="text-body-sm font-medium text-neutral-600">New unallocated balance</dt>
                <dd className="text-body-sm font-semibold text-neutral-900 tabular-nums">
                  {formatCurrency(newUnallocated.toFixed(2), currency)}
                </dd>
              </div>
            </dl>
          )}

          {error && (
            <Alert variant="danger" className="mt-4 w-full text-left" title="Could not remove allocation" description={error} />
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={submitting} disabled={submitting}>
          Remove allocation
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
