import type { FC } from 'react';
import { Trash2 } from 'lucide-react';
import { Modal } from '../../../common/Modal/Modal';
import { Button } from '../../../common/Button/Button';
import { Icon } from '../../../common/Icon/Icon';
import { Alert } from '../../../common/Alert/Alert';
import { PAYMENT_CURRENCY_CODE } from '../../../../constants/billing';
import { formatCurrency } from '../../../../utils/formatting';
import type { InvoiceListItem } from '../../../../types/billing';

interface DeleteInvoiceDialogProps {
  open: boolean;
  /** The draft invoice to delete (null while closed). */
  invoice: InvoiceListItem | null;
  submitting?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * DeleteInvoiceDialog — destructive delete-draft confirmation
 * (DELETE /billing/invoices/{id}).
 *
 * The backend performs a HARD delete of the draft + its line items (only
 * Draft status may be deleted), and the endpoint is ADMIN-only on the backend
 * (`_INVOICE_DELETE_ROLES`) — the action is gated client-side via
 * PermissionGate wherever it appears. The confirm button is disabled while a
 * request is in flight (no duplicate deletions).
 */
export const DeleteInvoiceDialog: FC<DeleteInvoiceDialogProps> = ({
  open,
  invoice,
  submitting = false,
  error = null,
  onConfirm,
  onClose,
}) => {
  return (
    <Modal open={open} onClose={onClose} size="sm" ariaLabel="Delete draft invoice">
      <Modal.Body className="pt-6">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-danger/10">
            <Icon icon={Trash2} size="lg" className="text-danger" />
          </div>
          <h2 className="text-h3 font-semibold text-neutral-900">Delete this draft invoice?</h2>
          <p className="mt-2 text-body text-neutral-500">
            This permanently deletes the draft and its line items. This action
            cannot be undone.
          </p>

          {invoice && (
            <dl className="mt-5 w-full space-y-2 rounded-lg border border-neutral-200 bg-neutral-50/60 px-4 py-3 text-left">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-body-sm text-neutral-500">Draft for</dt>
                <dd className="truncate text-body-sm font-medium text-neutral-900">
                  {invoice.patient.full_name}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-body-sm text-neutral-500">Line items</dt>
                <dd className="text-body-sm font-medium text-neutral-900 tabular-nums">
                  {invoice.item_count}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-body-sm text-neutral-500">Grand total</dt>
                <dd className="text-body-sm font-semibold text-neutral-900 tabular-nums">
                  {formatCurrency(invoice.financials.grand_total, PAYMENT_CURRENCY_CODE)}
                </dd>
              </div>
            </dl>
          )}

          {error && (
            <Alert variant="danger" className="mt-4 w-full text-left" title="Could not delete draft" description={error} />
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={submitting} disabled={submitting}>
          Delete draft
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
