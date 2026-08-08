import { useMemo, useState, type FC } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Modal } from '../../../common/Modal/Modal';
import { Button } from '../../../common/Button/Button';
import { Icon } from '../../../common/Icon/Icon';
import { Alert } from '../../../common/Alert/Alert';
import { Input } from '../../../common/Input';
import { StatusBadge } from '../../../common/StatusBadge/StatusBadge';
import {
  INVOICE_STATUS_VARIANTS,
  PAYMENT_CURRENCY_CODE,
  PAYMENT_CURRENCY_SYMBOL,
} from '../../../../constants/billing';
import { formatCurrency } from '../../../../utils/formatting';
import { useInvoices } from '../../../../hooks/billing/useInvoices';
import type { DialogPayment } from './CompletePaymentDialog';

interface AllocatePaymentDialogProps {
  open: boolean;
  /** The completed payment being allocated (null while closed). */
  payment: DialogPayment | null;
  submitting?: boolean;
  error?: string | null;
  onConfirm: (invoiceId: string, amount: string) => void;
  onClose: () => void;
}

/** Invoices the backend accepts for allocation (validate_payable). */
const PAYABLE_INVOICE_STATUSES = new Set(['issued', 'partially_paid', 'overdue']);

/**
 * AllocatePaymentDialog — POST /billing/payments/{id}/allocate.
 *
 * The backend requires a COMPLETED payment and a payable invoice (Issued /
 * Partially Paid / Overdue) with sufficient outstanding balance; a duplicate
 * allocation to the same invoice is rejected. The picker loads the payment's
 * patient invoices from the real list endpoint (page_size 100) and restricts
 * the chooser to payable, non-zero-outstanding rows — the backend remains the
 * authority and enforces balance/duplicate rules with 409/422 if the UI is
 * ever out of date.
 *
 * The amount is bounded by BOTH the payment's unallocated balance and the
 * selected invoice's outstanding balance (presentation mirror of the service
 * checks). The calculation card below the amount reuses the same backend
 * values.
 */
export const AllocatePaymentDialog: FC<AllocatePaymentDialogProps> = ({
  open,
  payment,
  submitting = false,
  error = null,
  onConfirm,
  onClose,
}) => {
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);

  const invoicesQuery = useInvoices(
    {
      page: 1,
      page_size: 100,
      sort_by: 'created_at',
      sort_order: 'desc',
      ...(payment ? { patient_id: payment.patient.id } : {}),
    },
    // Defer the invoice fetch until the dialog actually opens (same pattern as
    // the Invoice create drawer deferring treatment-plan lookups) so the
    // closed dialog never issues a network request.
    open && payment !== null,
  );

  // Only invoices the backend will accept: payable status + outstanding > 0.
  const payableInvoices = useMemo(() => {
    return (invoicesQuery.data?.items ?? []).filter((inv) => {
      if (!PAYABLE_INVOICE_STATUSES.has(inv.status)) return false;
      return Number(inv.financials.outstanding_amount) > 0;
    });
  }, [invoicesQuery.data?.items]);

  const selectedInvoice = payableInvoices.find((inv) => inv.id === selectedInvoiceId) ?? null;

  const unallocated = useMemo(
    () => Number(payment?.financials?.unallocated_amount ?? 0),
    [payment],
  );
  const outstanding = selectedInvoice
    ? Number(selectedInvoice.financials.outstanding_amount)
    : 0;

  const numericAmount = Number.isNaN(Number(amount)) ? 0 : Number(amount);
  const remainingAfterAllocation = Math.max(0, unallocated - numericAmount);

  const validateAmount = (value: string): string | null => {
    const n = Number(value);
    if (value.trim() === '' || Number.isNaN(n)) return 'Enter a valid amount';
    if (n <= 0) return 'Amount must be greater than 0';
    if (n > unallocated + 0.001) return 'Amount cannot exceed the unallocated balance';
    if (selectedInvoice && n > outstanding + 0.001) {
      return 'Amount cannot exceed the invoice outstanding balance';
    }
    return null;
  };

  const handleAmountChange = (value: string) => {
    setAmount(value);
    setAmountError(validateAmount(value));
  };

  const canSubmit =
    !submitting &&
    selectedInvoice !== null &&
    amount.trim() !== '' &&
    validateAmount(amount) === null;

  const handleConfirm = () => {
    if (!selectedInvoice) return;
    if (validateAmount(amount) !== null) {
      setAmountError(validateAmount(amount));
      return;
    }
    onConfirm(selectedInvoice.id, amount.trim());
  };

  return (
    <Modal open={open} onClose={onClose} size="md" ariaLabel="Allocate payment to an invoice">
      <Modal.Body className="pt-6">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-50">
            <Icon icon={ArrowUpRight} size="lg" className="text-primary-600" />
          </div>
          <h2 className="text-h3 font-semibold text-neutral-900">Allocate payment to an invoice</h2>
          <p className="mt-2 text-body text-neutral-500">
            Choose a payable invoice for {payment?.patient.full_name ?? 'the patient'} and
            enter how much of this payment to apply.
          </p>
        </div>

        <div className="mt-5 text-left">
          <fieldset>
            <legend className="text-label font-semibold text-neutral-700">
              Invoice <span className="text-danger" aria-hidden="true">*</span>
            </legend>
            {invoicesQuery.isLoading ? (
              <p className="mt-2 text-body-sm text-neutral-500">Loading invoices…</p>
            ) : payableInvoices.length === 0 ? (
              <p className="mt-2 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-body-sm text-neutral-500">
                No payable invoices for {payment?.patient.full_name ?? 'this patient'}. An
                invoice must be Issued, Partially Paid, or Overdue with an
                outstanding balance.
              </p>
            ) : (
              <div
                role="radiogroup"
                aria-label="Payable invoices"
                className="mt-2 max-h-56 space-y-1.5 overflow-y-auto pr-1"
              >
                {payableInvoices.map((inv) => {
                  const isSelected = inv.id === selectedInvoiceId;
                  return (
                    <label
                      key={inv.id}
                      className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2.5 transition-colors duration-100 ${
                        isSelected
                          ? 'border-primary-300 bg-primary-50/60'
                          : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                      }`}
                    >
                      <span className="flex items-center gap-3 min-w-0">
                        <input
                          type="radio"
                          name="invoice-radio"
                          value={inv.id}
                          checked={isSelected}
                          onChange={() => {
                            setSelectedInvoiceId(inv.id);
                            const suggested = Math.min(
                              Number(inv.financials.outstanding_amount),
                              unallocated,
                            );
                            setAmount(suggested > 0 ? suggested.toFixed(2) : '');
                            setAmountError(null);
                          }}
                          className="h-4 w-4 shrink-0 accent-primary-600"
                        />
                        <span className="min-w-0">
                          <span className="block font-mono text-label font-medium text-neutral-900">
                            {inv.invoice_number}
                          </span>
                          <span className="mt-0.5 block truncate text-caption text-neutral-400">
                            {inv.patient.full_name}
                          </span>
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <StatusBadge status={inv.status} statusMap={INVOICE_STATUS_VARIANTS} size="sm" />
                        <span className="text-body-sm font-medium text-neutral-700 tabular-nums">
                          {formatCurrency(inv.financials.outstanding_amount, PAYMENT_CURRENCY_CODE)} due
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </fieldset>

          <div className="mt-4">
            <Input
              label="Allocation Amount"
              required
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              prefix={PAYMENT_CURRENCY_SYMBOL}
              disabled={!selectedInvoice}
              error={amountError ?? undefined}
              helperText={selectedInvoice ? 'Maximum: the invoice outstanding balance' : 'Select an invoice first'}
            />
          </div>

          {selectedInvoice && (
            <dl className="mt-4 space-y-2 rounded-lg border border-neutral-200 bg-neutral-50/60 px-4 py-3 text-left">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-body-sm text-neutral-500">Unallocated on payment</dt>
                <dd className="text-body-sm font-medium text-neutral-900 tabular-nums">
                  {formatCurrency(payment?.financials.unallocated_amount ?? '0.00', PAYMENT_CURRENCY_CODE)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-body-sm text-neutral-500">Invoice outstanding</dt>
                <dd className="text-body-sm font-medium text-neutral-900 tabular-nums">
                  {formatCurrency(selectedInvoice.financials.outstanding_amount, PAYMENT_CURRENCY_CODE)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-neutral-200 pt-2">
                <dt className="text-body-sm font-medium text-neutral-600">Remaining after allocation</dt>
                <dd className="text-body-sm font-semibold text-neutral-900 tabular-nums">
                  {formatCurrency(remainingAfterAllocation.toFixed(2), PAYMENT_CURRENCY_CODE)}
                </dd>
              </div>
            </dl>
          )}

          {error && (
            <Alert variant="danger" className="mt-4 w-full text-left" title="Could not allocate payment" description={error} />
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleConfirm} loading={submitting} disabled={!canSubmit}>
          Allocate
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
