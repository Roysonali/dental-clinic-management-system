import { useEffect, type FC } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, Info } from 'lucide-react';
import { Drawer } from '../../../common/Drawer/Drawer';
import { IconButton } from '../../../common/Button/IconButton';
import { Icon } from '../../../common/Icon/Icon';
import { Form, FormActions, ValidationSummary } from '../../../common/Form';
import { Textarea, DatePicker } from '../../../common/Input';
import { Skeleton } from '../../../common/Skeleton/Skeleton';
import { INVOICE_NOTES_MAX_LENGTH } from '../../../../constants/billing';
import { invoiceEditFormSchema, type InvoiceEditFormValues } from '../../../../utils/invoiceFormSchema';
import { invoiceToEditFormValues } from '../../../../utils/invoiceFormUtils';
import { formatCurrency } from '../../../../utils/formatting';
import type { InvoiceRead } from '../../../../types/billing';

interface EditInvoiceDrawerProps {
  open: boolean;
  /** Full aggregate (fetched lazily by the container) — null while loading. */
  invoice: InvoiceRead | null;
  /** True while the lazily-fetched aggregate is in flight. */
  loading?: boolean;
  onClose: () => void;
  onSubmit: (values: InvoiceEditFormValues) => void;
  submitting?: boolean;
  serverErrors?: Record<string, string>;
  serverMessage?: string | null;
}

/**
 * EditInvoiceDrawer — edit-draft invoice workflow (Sprint 14A.2).
 *
 * The backend PATCH contract (`InvoiceDraftUpdateRequest`) supports ONLY
 * `notes` and `due_date` on Draft invoices — line items are NOT editable in
 * this release — so this drawer exposes exactly those two fields and shows a
 * read-only summary (patient / doctor / grand total) instead of a full form.
 *
 * The whole drawer — including the sticky footer — is wrapped in a single
 * `<Form>` so the footer's "Save changes" button is a form descendant while
 * the footer stays pinned to the bottom of the drawer.
 */
export const EditInvoiceDrawer: FC<EditInvoiceDrawerProps> = ({
  open,
  invoice,
  loading = false,
  onClose,
  onSubmit,
  submitting = false,
  serverErrors = {},
  serverMessage = null,
}) => {
  const {
    register,
    handleSubmit,
    control,
    reset,
    trigger,
    formState: { errors, isValid },
  } = useForm<InvoiceEditFormValues>({
    resolver: zodResolver(invoiceEditFormSchema),
    mode: 'onChange',
    defaultValues: { due_date: '', notes: '' },
  });

  // Repopulate whenever the drawer opens with a fresh aggregate. `trigger()`
  // then runs the resolver on the (valid) prefill so `isValid` — and therefore
  // the Save button — reflects the loaded draft immediately instead of staying
  // disabled until the user edits a field.
  useEffect(() => {
    if (open && invoice) {
      reset(invoiceToEditFormValues(invoice));
      void trigger();
    }
  }, [open, invoice, reset, trigger]);

  const fieldError = (field: keyof InvoiceEditFormValues) =>
    errors[field]?.message ?? serverErrors[field];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      position="right"
      size="lg"
      ariaLabel="Edit draft invoice"
      className="!max-w-[40vw] min-w-[460px] max-sm:!max-w-full max-sm:min-w-0"
    >
      <Form onSubmit={handleSubmit(onSubmit)} className="flex h-full flex-col">
        <Drawer.Header>
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-h3 font-semibold tracking-tight text-neutral-900">Edit draft invoice</h2>
              <p className="text-caption text-neutral-500">Draft — number assigned on issue</p>
            </div>
            <IconButton
              icon={<Icon icon={X} size="sm" />}
              aria-label="Close"
              variant="ghost"
              size="sm"
              onClick={onClose}
            />
          </div>
        </Drawer.Header>

        <Drawer.Body>
          {serverMessage && (
            <div role="alert" className="mb-4 rounded-lg border border-danger/25 bg-danger/10 p-4">
              <p className="text-body-sm text-danger">{serverMessage}</p>
            </div>
          )}

          {loading || !invoice ? (
            <div className="space-y-4" role="status" aria-label="Loading invoice">
              <Skeleton variant="card" className="h-28" />
              <Skeleton variant="card" className="h-40" />
            </div>
          ) : (
            <>
              {/* Read-only summary */}
              <div className="rounded-lg border border-neutral-200 bg-neutral-50/60 p-4">
                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <dt className="text-caption font-medium uppercase tracking-wide text-neutral-500">Patient</dt>
                    <dd className="mt-1 text-body font-medium text-neutral-900">
                      {invoice.patient.full_name}
                      <span className="block text-caption font-normal text-neutral-400">
                        {invoice.patient.patient_code}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-caption font-medium uppercase tracking-wide text-neutral-500">Doctor</dt>
                    <dd className="mt-1 text-body font-medium text-neutral-900">
                      {invoice.doctor?.user_full_name ?? '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-caption font-medium uppercase tracking-wide text-neutral-500">Grand Total</dt>
                    <dd className="mt-1 text-body font-semibold text-neutral-900 tabular-nums">
                      {formatCurrency(invoice.financials.grand_total, invoice.financials.currency_code)}
                    </dd>
                  </div>
                </dl>
              </div>

              <ValidationSummary errors={{ ...serverErrors, ...errors }} />

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2 rounded-lg border border-info/25 bg-info/5 p-3">
                  <p className="flex items-start gap-2 text-body-sm text-info">
                    <Icon icon={Info} size="sm" className="mt-0.5 shrink-0" />
                    Line items cannot be edited in this release. Only the due date
                    and notes can be changed on a draft invoice (backend contract).
                  </p>
                </div>
                <Controller
                  control={control}
                  name="due_date"
                  render={({ field }) => (
                    <DatePicker
                      label="Due Date"
                      required
                      value={field.value || undefined}
                      onChange={field.onChange}
                      error={fieldError('due_date')}
                      minDate={invoice.invoice_date}
                      helperText="Must be on or after the invoice date"
                    />
                  )}
                />
                <div className="md:col-span-2">
                  <Textarea
                    label="Notes"
                    placeholder="Optional notes for this invoice…"
                    maxLength={INVOICE_NOTES_MAX_LENGTH}
                    showCharCount
                    error={fieldError('notes')}
                    {...register('notes')}
                  />
                </div>
              </div>
            </>
          )}
        </Drawer.Body>

        <Drawer.Footer>
          <FormActions
            onCancel={onClose}
            submitting={submitting}
            submitDisabled={submitting || !isValid || loading || !invoice}
            submitText="Save changes"
            cancelDisabled={submitting}
          />
        </Drawer.Footer>
      </Form>
    </Drawer>
  );
};
