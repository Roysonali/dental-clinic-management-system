import type { FC } from 'react';
import { RefreshCw } from 'lucide-react';
import { Modal } from '../../../common/Modal/Modal';
import { Button } from '../../../common/Button/Button';
import { Icon } from '../../../common/Icon/Icon';
import { Alert } from '../../../common/Alert/Alert';
import { formatReceiptAmount } from '../../../../utils/receiptFormatting';
import type { ReceiptRead } from '../../../../types/billing';

interface RegenerateReceiptDialogProps {
  open: boolean;
  /** The receipt to regenerate (null while closed). */
  receipt: ReceiptRead | null;
  submitting?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * RegenerateReceiptDialog — confirm POST /billing/receipts/{id}/regenerate
 * (reference spec §13).
 *
 * Same modal visual language as Generate Receipt. Regeneration is a
 * document-reproduction workflow — amounts and dates do not change — so the
 * confirm action is primary (blue), never destructive red.
 */
export const RegenerateReceiptDialog: FC<RegenerateReceiptDialogProps> = ({
  open,
  receipt,
  submitting = false,
  error = null,
  onConfirm,
  onClose,
}) => {
  return (
    <Modal open={open} onClose={onClose} size="sm" ariaLabel="Regenerate receipt">
      <Modal.Body className="pt-6">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-50">
            <Icon icon={RefreshCw} size="lg" className="text-primary-600" />
          </div>
          <h2 className="text-h3 font-semibold text-neutral-900">Regenerate this receipt?</h2>
          <p className="mt-2 text-body text-neutral-500">
            {receipt?.receipt_number ?? 'This receipt'} will be reproduced from
            the current payment record. Amounts and dates do not change.
          </p>

          {receipt && (
            <dl className="mt-5 w-full space-y-2 rounded-lg border border-primary-100 bg-primary-50/60 px-4 py-3 text-left">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-body-sm text-neutral-500">Receipt</dt>
                <dd className="font-mono text-body-sm font-medium text-neutral-900">
                  {receipt.receipt_number}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-body-sm text-neutral-500">Amount</dt>
                <dd className="text-body-sm font-semibold text-neutral-900 tabular-nums">
                  {formatReceiptAmount(receipt.amount)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-body-sm text-neutral-500">Print count</dt>
                <dd className="text-body-sm font-medium text-neutral-900 tabular-nums">
                  {receipt.print_metadata?.print_count != null ? receipt.print_metadata.print_count : '—'}
                </dd>
              </div>
            </dl>
          )}

          {error && (
            <Alert
              variant="danger"
              className="mt-4 w-full text-left"
              title="Could not regenerate receipt"
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
          Regenerate
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
