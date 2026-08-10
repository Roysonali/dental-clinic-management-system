import { useEffect, useMemo, useState, type FC, type ChangeEvent } from 'react';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { Drawer } from '../../common/Drawer/Drawer';
import { IconButton } from '../../common/Button/IconButton';
import { Icon } from '../../common/Icon/Icon';
import { Form, FormActions, ValidationSummary } from '../../common/Form';
import { Select, Textarea, DatePicker } from '../../common/Input';
import { CREDIT_NOTE_REASON_MAX_LENGTH } from '../../../constants/billing';
import {
  creditNoteCreateFormSchema,
  type CreditNoteCreateFormValues,
} from '../../../utils/creditNoteFormSchema';
import { formatCreditNoteAmount } from '../../../utils/creditNoteFormatting';
import { billingService } from '../../../services/billingService';
import { patientService } from '../../../services/patientService';
import { billingQueryKeys } from '../../../hooks/billing/billingQueryKeys';
import { patientQueryKeys } from '../../../hooks/patients/usePatients';
import type { CreditNoteInvoiceOption, InvoiceRead } from '../../../types/billing';

interface CreateCreditNoteDrawerProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: CreditNoteCreateFormValues) => void;
  submitting?: boolean;
  serverErrors?: Record<string, string>;
  serverMessage?: string | null;
  defaultInvoiceId?: string;
  defaultPatientId?: string;
}

interface InvoiceOption {
  value: string;
  label: string;
}

interface PatientOption {
  value: string;
  label: string;
}

/** Build the invoice summary block shown under the Invoice select. */
function toCreditNoteInvoiceOption(invoice: InvoiceRead): CreditNoteInvoiceOption {
  return {
    id: invoice.id,
    invoice_number: invoice.invoice_number,
    patient: invoice.patient,
    financials: invoice.financials,
    // The backend enforces amount <= invoice grand total at creation time
    // (BR-91) but exposes no already-credited figure; this block is
    // informational only and the backend remains the source of truth.
    already_credited: '0.00',
    remaining_allowed: invoice.financials.grand_total,
  };
}

/**
 * CreateCreditNoteDrawer — create-draft-credit-note workflow (Sprint 14A.4).
 *
 * Drawer ≈ 40–45% viewport width on desktop, sticky footer, internally
 * scrolling body. Pre-selects invoice/patient when provided. Selecting an
 * invoice auto-fills the patient from the invoice (the credit note belongs
 * to the invoice's patient) and keeps the react-hook-form values in sync so
 * the submitted payload always matches what the user sees.
 *
 * Dropdown data uses TanStack Query (the established billing pattern — see
 * CreateInvoiceDrawer), gated on `open` so nothing is fetched while closed.
 */
export const CreateCreditNoteDrawer: FC<CreateCreditNoteDrawerProps> = ({
  open,
  onClose,
  onSubmit,
  submitting = false,
  serverErrors = {},
  serverMessage = null,
  defaultInvoiceId,
  defaultPatientId,
}) => {
  const queryClient = useQueryClient();
  const {
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors, isValid },
  } = useForm<CreditNoteCreateFormValues>({
    resolver: zodResolver(creditNoteCreateFormSchema),
    mode: 'onChange',
    defaultValues: {
      invoice_id: defaultInvoiceId ?? '',
      patient_id: defaultPatientId ?? '',
      amount: '',
      reason: '',
      expiry_date: '',
    },
  });

  // Manual invoice pick (set only in event handlers — never in effects).
  const [pickedInvoice, setPickedInvoice] = useState<CreditNoteInvoiceOption | null>(null);

  // Fresh form each time the drawer opens.
  useEffect(() => {
    if (open) {
      reset({
        invoice_id: defaultInvoiceId ?? '',
        patient_id: defaultPatientId ?? '',
        amount: '',
        reason: '',
        expiry_date: '',
      });
    }
  }, [open, reset, defaultInvoiceId, defaultPatientId]);

  // Invoice + patient dropdown options — fetched only while the drawer is open.
  const invoicesQuery = useQuery({
    queryKey: billingQueryKeys.invoiceList({
      page: 1,
      page_size: 50,
      sort_by: 'created_at',
      sort_order: 'desc',
    }),
    queryFn: () =>
      billingService.listInvoices({
        page: 1,
        page_size: 50,
        sort_by: 'created_at',
        sort_order: 'desc',
      }),
    enabled: open,
  });

  const patientsQuery = useQuery({
    queryKey: patientQueryKeys.list({ page: 1, page_size: 50 }),
    queryFn: () => patientService.list({ page: 1, page_size: 50 }),
    enabled: open,
  });

  const invoiceOptions: InvoiceOption[] = useMemo(
    () =>
      (invoicesQuery.data?.items ?? []).map((inv) => ({
        value: inv.id,
        label: `${inv.invoice_number} · ${formatCreditNoteAmount(inv.financials.grand_total, inv.financials.currency_code)}`,
      })),
    [invoicesQuery.data?.items],
  );

  const patientOptions: PatientOption[] = useMemo(
    () =>
      (patientsQuery.data?.items ?? []).map((p) => ({
        value: p.id,
        label: `${p.full_name} · ${p.patient_code}`,
      })),
    [patientsQuery.data?.items],
  );

  // When a default invoice is provided, load its summary and sync the
  // patient field to the invoice's patient.
  const defaultInvoiceQuery = useQuery({
    queryKey: billingQueryKeys.invoiceDetail(defaultInvoiceId ?? ''),
    queryFn: () => {
      if (!defaultInvoiceId) throw new Error('No default invoice selected');
      return billingService.getInvoice(defaultInvoiceId);
    },
    enabled: open && !!defaultInvoiceId,
  });

  // Keep the patient field in sync with the default invoice's patient.
  useEffect(() => {
    const invoice = defaultInvoiceQuery.data;
    if (!invoice) return;
    setValue('patient_id', invoice.patient.id, { shouldValidate: true });
  }, [defaultInvoiceQuery.data, setValue]);

  const fieldError = (field: keyof CreditNoteCreateFormValues) =>
    errors[field]?.message ?? serverErrors[field];

  const combinedValidation = useMemo<Record<string, unknown>>(
    () => ({ ...serverErrors, ...errors }),
    [errors, serverErrors],
  );

  const watchedAmount = useWatch({ control, name: 'amount' });
  const watchedInvoiceId = useWatch({ control, name: 'invoice_id' });
  const parsedAmount = Number(watchedAmount);

  // Derived invoice summary — shown only when it matches the invoice the
  // form actually holds, so a stale pick (e.g. across drawer opens when a
  // consumer does not remount via `key`) can never render a wrong total.
  const selectedInvoice = useMemo<CreditNoteInvoiceOption | null>(() => {
    if (pickedInvoice && pickedInvoice.id === watchedInvoiceId) return pickedInvoice;
    const defaultInvoice = defaultInvoiceQuery.data;
    if (defaultInvoice && defaultInvoice.id === watchedInvoiceId) {
      return toCreditNoteInvoiceOption(defaultInvoice);
    }
    return null;
  }, [pickedInvoice, watchedInvoiceId, defaultInvoiceQuery.data]);

  const remainingAfterNote = useMemo(() => {
    if (!selectedInvoice || Number.isNaN(parsedAmount) || parsedAmount <= 0) return null;
    const grandTotal = Number(selectedInvoice.financials.grand_total);
    const remaining = grandTotal - parsedAmount;
    return remaining < 0 ? 0 : remaining;
  }, [selectedInvoice, parsedAmount]);

  const handleInvoiceChange = async (e: ChangeEvent<HTMLSelectElement>) => {
    const invId = e.target.value;
    if (!invId) {
      setPickedInvoice(null);
      setValue('invoice_id', '', { shouldValidate: true });
      return;
    }
    // Reflect the selection immediately; refresh the summary + patient
    // once the full invoice loads (reusing the invoice-detail cache when
    // the invoice was already fetched).
    setValue('invoice_id', invId, { shouldValidate: true });
    try {
      const invoice = await queryClient.ensureQueryData({
        queryKey: billingQueryKeys.invoiceDetail(invId),
        queryFn: () => billingService.getInvoice(invId),
      });
      setPickedInvoice(toCreditNoteInvoiceOption(invoice));
      setValue('patient_id', invoice.patient.id, { shouldValidate: true });
    } catch {
      setPickedInvoice(null);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      position="right"
      size="xl"
      ariaLabel="Create credit note"
      className="!max-w-[46vw] min-w-[520px] max-sm:!max-w-full max-sm:min-w-0"
    >
      <Form onSubmit={handleSubmit(onSubmit)} className="flex h-full flex-col">
        <Drawer.Header>
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-h3 font-semibold tracking-tight text-neutral-900">Create credit note</h2>
              <p className="text-caption text-neutral-500">Saved as DRAFT · number CN-##### assigned on issue</p>
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

          <ValidationSummary errors={combinedValidation} title="A few fields need attention before this draft can be saved:" />

          <div className="mt-4 grid grid-cols-1 gap-4">
            <Controller
              control={control}
              name="invoice_id"
              render={({ field }) => (
                <Select
                  label="Invoice"
                  required
                  placeholder={invoicesQuery.isLoading ? 'Loading invoices…' : 'Select an invoice'}
                  options={invoiceOptions}
                  value={field.value}
                  onChange={handleInvoiceChange}
                  error={fieldError('invoice_id')}
                />
              )}
            />

            <Controller
              control={control}
              name="patient_id"
              render={({ field }) => (
                <Select
                  label="Patient"
                  required
                  placeholder={patientsQuery.isLoading ? 'Loading patients…' : 'Select a patient'}
                  options={patientOptions}
                  value={field.value}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => field.onChange(e.target.value)}
                  error={fieldError('patient_id')}
                />
              )}
            />

            {selectedInvoice && (
              <div className="rounded-lg border border-neutral-200 bg-neutral-50/60 px-4 py-3">
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-caption font-medium uppercase tracking-wide text-neutral-500">Invoice Grand Total</span>
                    <span className="text-body-sm font-semibold text-neutral-900 tabular-nums">
                      {formatCreditNoteAmount(selectedInvoice.financials.grand_total, selectedInvoice.financials.currency_code)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-caption font-medium uppercase tracking-wide text-neutral-500">Already Credited</span>
                    <span className="text-body-sm font-semibold text-neutral-900 tabular-nums">
                      {formatCreditNoteAmount(selectedInvoice.already_credited, selectedInvoice.financials.currency_code)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-caption font-medium uppercase tracking-wide text-neutral-500">Remaining Allowed</span>
                    <span className="text-body-sm font-semibold text-neutral-900 tabular-nums">
                      {formatCreditNoteAmount(selectedInvoice.remaining_allowed, selectedInvoice.financials.currency_code)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <Controller
              control={control}
              name="amount"
              render={({ field }) => (
                <div>
                  <label htmlFor={field.name} className="mb-1.5 block text-caption font-medium uppercase tracking-wide text-neutral-500">
                    Amount <span className="text-danger">*</span>
                  </label>
                  <input
                    {...field}
                    id={field.name}
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    className={`
                      w-full rounded-lg border bg-white px-3 py-2.5 text-body text-neutral-800
                      transition-colors duration-150
                      focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500
                      ${fieldError('amount') ? 'border-danger focus:ring-danger/20 focus:border-danger' : 'border-neutral-300 hover:border-neutral-400'}
                    `}
                    aria-invalid={!!fieldError('amount')}
                    aria-describedby={fieldError('amount') ? `${field.name}-error` : undefined}
                  />
                  {fieldError('amount') && (
                    <p id={`${field.name}-error`} className="mt-1 text-body-sm text-danger">{fieldError('amount')}</p>
                  )}
                  {remainingAfterNote !== null && selectedInvoice && (
                    <p className="mt-1 text-caption text-neutral-400">
                      Remaining allowed after this note: {formatCreditNoteAmount(remainingAfterNote, selectedInvoice.financials.currency_code)}
                    </p>
                  )}
                </div>
              )}
            />

            <Controller
              control={control}
              name="reason"
              render={({ field }) => (
                <Textarea
                  label="Reason"
                  required
                  placeholder="Reason for issuing the credit note…"
                  maxLength={CREDIT_NOTE_REASON_MAX_LENGTH}
                  showCharCount
                  error={fieldError('reason')}
                  {...field}
                />
              )}
            />

            <Controller
              control={control}
              name="expiry_date"
              render={({ field }) => (
                <DatePicker
                  label="Expiry Date"
                  value={field.value || undefined}
                  onChange={field.onChange}
                  error={fieldError('expiry_date')}
                  helperText="Optional — leave blank for no expiry"
                />
              )}
            />
          </div>
        </Drawer.Body>

        <Drawer.Footer>
          <FormActions
            onCancel={onClose}
            submitting={submitting}
            submitDisabled={submitting || !isValid}
            submitText="Save draft"
            cancelDisabled={submitting}
          />
        </Drawer.Footer>
      </Form>
    </Drawer>
  );
};
