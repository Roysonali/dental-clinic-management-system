import type { FC } from 'react';
import { Send } from 'lucide-react';
import { Modal } from '../../common/Modal/Modal';
import { Button } from '../../common/Button/Button';
import { Icon } from '../../common/Icon/Icon';
import { Alert } from '../../common/Alert/Alert';
import { formatCreditNoteAmount } from '../../../utils/creditNoteFormatting';
import type { CreditNoteRead } from '../../../types/billing';

interface IssueCreditNoteDialogProps {
  open: boolean;
  creditNote: CreditNoteRead | null;
  submitting?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

export const IssueCreditNoteDialog: FC<IssueCreditNoteDialogProps> = ({
  open,
  creditNote,
  submitting = false,
  error = null,
  onConfirm,
  onClose,
}) => {
  return (
    <Modal open={open} onClose={onClose} size="sm" ariaLabel="Issue credit note">
      <Modal.Body className="pt-6">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50">
            <Icon icon={Send} size="lg" className="text-primary-600" />
          </div>
          <h2 className="text-h3 font-semibold text-neutral-900">Issue this credit note?</h2>
          <p className="mt-2 text-body text-neutral-500">
            A permanent credit note number will be assigned and the credit note becomes immutable.
          </p>

          {creditNote && (
            <div className="mt-5 w-full rounded-lg border border-neutral-200 bg-neutral-50/60 px-4 py-3">
              <dl className="grid grid-cols-2 gap-3 text-left">
                <div>
                  <dt className="text-caption font-medium uppercase tracking-wide text-neutral-500">Invoice</dt>
                  <dd className="mt-0.5 truncate text-body font-medium text-neutral-900">
                    {creditNote.invoice.invoice_number}
                  </dd>
                </div>
                <div>
                  <dt className="text-caption font-medium uppercase tracking-wide text-neutral-500">Amount</dt>
                  <dd className="mt-0.5 text-body font-semibold text-neutral-900 tabular-nums">
                    {formatCreditNoteAmount(creditNote.amount, creditNote.financials.currency_code)}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {error && (
            <Alert variant="danger" className="mt-4 w-full text-left" title="Could not issue credit note" description={error} />
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button variant="primary" onClick={onConfirm} loading={submitting} disabled={submitting}>
          Issue credit note
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
