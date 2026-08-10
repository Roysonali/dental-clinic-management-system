import type { FC } from 'react';
import { Send } from 'lucide-react';
import { Modal } from '../../../common/Modal/Modal';
import { Button } from '../../../common/Button/Button';
import { Icon } from '../../../common/Icon/Icon';
import { Alert } from '../../../common/Alert/Alert';
import { PAYMENT_CURRENCY_CODE } from '../../../../constants/billing';
import { formatCurrency } from '../../../../utils/formatting';
import type { InvoiceListItem } from '../../../../types/billing';

interface IssueInvoiceDialogProps {
  open: boolean;
  /** The invoice to issue (null while closed). */
  invoice: InvoiceListItem | null;
  submitting?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * IssueInvoiceDialog — confirm issuing a Draft invoice
 * (POST /billing/invoices/{id}/issue).
 *
 * The backend assigns a permanent sequential number (INV-xxxxx) and the
 * invoice becomes immutable (ADR-002). Only shown when the state machine
 * permits issuing (Draft status) — never on already-issued invoices. The
 * confirm button is disabled while the request is in flight (no duplicate
 * submissions).
 */
export const IssueInvoiceDialog: FC<IssueInvoiceDialogProps> = ({
  open,
  invoice,
  submitting = false,
  error = null,
  onConfirm,
  onClose,
}) => {
  return (
    <Modal open={open} onClose={onClose} size="sm" ariaLabel="Issue invoice">
      <Modal.Body className="pt-6">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50">
            <Icon icon={Send} size="lg" className="text-primary-600" />
          </div>
          <h2 className="text-h3 font-semibold text-neutral-900">Issue this invoice?</h2>
          <p className="mt-2 text-body text-neutral-500">
            A permanent invoice number will be assigned and the invoice becomes
            immutable.
          </p>

          {invoice && (
            <div className="mt-5 w-full rounded-lg border border-neutral-200 bg-neutral-50/60 px-4 py-3">
              <dl className="grid grid-cols-2 gap-3 text-left">
                <div>
                  <dt className="text-caption font-medium uppercase tracking-wide text-neutral-500">Patient</dt>
                  <dd className="mt-0.5 truncate text-body font-medium text-neutral-900">
                    {invoice.patient.full_name}
                  </dd>
                </div>
                <div>
                  <dt className="text-caption font-medium uppercase tracking-wide text-neutral-500">Grand Total</dt>
                  <dd className="mt-0.5 text-body font-semibold text-neutral-900 tabular-nums">
                    {formatCurrency(invoice.financials.grand_total, PAYMENT_CURRENCY_CODE)}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {error && (
            <Alert variant="danger" className="mt-4 w-full text-left" title="Could not issue invoice" description={error} />
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button variant="primary" onClick={onConfirm} loading={submitting} disabled={submitting}>
          Issue invoice
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
