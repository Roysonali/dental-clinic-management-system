import { useEffect, type FC } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '../../../common/Modal/Modal';
import { Button } from '../../../common/Button/Button';
import { Alert } from '../../../common/Alert/Alert';
import { Form, ValidationSummary } from '../../../common/Form';
import { Textarea } from '../../../common/Input';
import { INVOICE_CANCEL_REASON_MAX_LENGTH } from '../../../../constants/billing';
import {
  invoiceCancelFormSchema,
  type InvoiceCancelFormValues,
} from '../../../../utils/invoiceFormSchema';
import type { InvoiceListItem } from '../../../../types/billing';

interface CancelInvoiceDialogProps {
  open: boolean;
  /** The invoice to cancel (null while closed). */
  invoice: InvoiceListItem | null;
  submitting?: boolean;
  error?: string | null;
  /** Receives the validated cancellation reason. */
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

/**
 * CancelInvoiceDialog — destructive cancel confirmation
 * (POST /billing/invoices/{id}/cancel).
 *
 * A cancellation reason is REQUIRED by the backend (1–500 chars). The
 * confirm button stays disabled until the reason is valid, and disabled
 * while a request is in flight (no duplicate submissions). The destructive
 * action is clearly identified with the danger variant.
 */
export const CancelInvoiceDialog: FC<CancelInvoiceDialogProps> = ({
  open,
  invoice,
  submitting = false,
  error = null,
  onConfirm,
  onClose,
}) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = useForm<InvoiceCancelFormValues>({
    resolver: zodResolver(invoiceCancelFormSchema),
    mode: 'onChange',
    defaultValues: { cancellation_reason: '' },
  });

  // Fresh reason each open.
  useEffect(() => {
    if (open) reset({ cancellation_reason: '' });
  }, [open, reset]);

  const reasonError = errors.cancellation_reason?.message ?? null;

  return (
    <Modal open={open} onClose={onClose} size="sm" ariaLabel="Cancel invoice">
      <Modal.Header>
        <h2 className="text-h4 font-semibold text-neutral-900">Cancel this invoice?</h2>
      </Modal.Header>
      <Modal.Body>
        <p className="text-body text-neutral-600">
          {invoice
            ? `Invoice ${invoice.invoice_number} for ${invoice.patient.full_name} will be moved to Cancelled.`
            : 'This invoice will be moved to Cancelled.'}{' '}
          Cancellation is recorded on the invoice and cannot be undone.
        </p>

        <Form grid columns={1} spacing="md" onSubmit={handleSubmit((values) => onConfirm(values.cancellation_reason))} className="mt-4">
          <Textarea
            label="Reason"
            required
            placeholder="Explain why this invoice is being cancelled…"
            maxLength={INVOICE_CANCEL_REASON_MAX_LENGTH}
            showCharCount
            error={reasonError ?? undefined}
            {...register('cancellation_reason')}
          />
        </Form>

        <ValidationSummary errors={errors} className="mt-4" />

        {error && (
          <Alert variant="danger" className="mt-4" title="Could not cancel invoice" description={error} />
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Keep invoice
        </Button>
        <Button
          variant="danger"
          onClick={handleSubmit((values) => onConfirm(values.cancellation_reason))}
          loading={submitting}
          disabled={submitting || !isValid}
        >
          Cancel invoice
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
