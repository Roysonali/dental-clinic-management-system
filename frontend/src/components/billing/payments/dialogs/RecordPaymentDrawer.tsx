import { useEffect, type FC } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, Info } from 'lucide-react';
import { Drawer } from '../../../common/Drawer/Drawer';
import { IconButton } from '../../../common/Button/IconButton';
import { Icon } from '../../../common/Icon/Icon';
import { Form, FormActions, ValidationSummary } from '../../../common/Form';
import { Input, Select, Textarea, DatePicker } from '../../../common/Input';
import { PatientPicker } from '../../../appointments/PatientPicker';
import {
  PAYMENT_CURRENCY_CODE,
  PAYMENT_CURRENCY_SYMBOL,
  PAYMENT_METHOD_OPTIONS,
  PAYMENT_NOTES_MAX_LENGTH,
  PAYMENT_REFERENCE_MAX_LENGTH,
} from '../../../../constants/billing';
import { paymentFormSchema, type PaymentFormValues } from '../../../../utils/paymentFormSchema';
import { defaultPaymentFormValues } from '../../../../utils/paymentFormUtils';

interface RecordPaymentDrawerProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: PaymentFormValues) => void;
  submitting?: boolean;
  serverErrors?: Record<string, string>;
  serverMessage?: string | null;
}

/**
 * RecordPaymentDrawer — create-payment workflow (Sprint 14A.3).
 *
 * Drawer ≈ 500–520px on desktop, sticky footer, internally scrolling body.
 * The whole drawer — including the sticky footer — is wrapped in a single
 * `<Form>` so the footer's "Save payment" submit button is a form descendant
 * (HTML submit semantics) while the footer stays pinned (the invoice drawer
 * fix pattern; no regression possible here).
 *
 * Fields map exactly to backend `PaymentCreateRequest`: patient (required),
 * payment method (required), total amount (positive, 2dp — the backend
 * applies its own Decimal quantization), payment date (required), optional
 * reference number (<= 100) and notes (<= 500). The informational callout at
 * the bottom states the backend lifecycle fact: created as PENDING, completed
 * before allocation/receipt.
 */
export const RecordPaymentDrawer: FC<RecordPaymentDrawerProps> = ({
  open,
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
    formState: { errors, isValid },
  } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    mode: 'onChange',
    defaultValues: defaultPaymentFormValues(),
  });

  // Fresh form each time the drawer opens (payment date defaults to today).
  useEffect(() => {
    if (open) reset(defaultPaymentFormValues());
  }, [open, reset]);

  const fieldError = (field: keyof PaymentFormValues) =>
    errors[field]?.message ?? serverErrors[field];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      position="right"
      size="lg"
      ariaLabel="Record payment"
      className="!max-w-[44vw] min-w-[500px] max-sm:!max-w-full max-sm:min-w-0"
    >
      <Form onSubmit={handleSubmit(onSubmit)} className="flex h-full flex-col">
        <Drawer.Header>
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-h3 font-semibold tracking-tight text-neutral-900">Record payment</h2>
              <p className="text-caption text-neutral-500">
                Saved as PENDING · number PAY-##### assigned on save
              </p>
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

          <ValidationSummary errors={{ ...serverErrors, ...errors }} title="A few fields need attention before this payment can be saved:" />

          {/* Reference pairing: Row 1 Patient | Payment Method, Row 2 Total
              Amount | Payment Date, Row 3 Reference (full width), Row 4 Notes
              (full width). */}
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <Controller
              control={control}
              name="patient_id"
              render={({ field }) => (
                <PatientPicker
                  value={field.value}
                  onChange={field.onChange}
                  error={fieldError('patient_id')}
                  required
                />
              )}
            />

            <Controller
              control={control}
              name="payment_method"
              render={({ field }) => (
                <Select
                  label="Payment Method"
                  required
                  placeholder="Select a method"
                  options={PAYMENT_METHOD_OPTIONS}
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  error={fieldError('payment_method')}
                />
              )}
            />

            <Input
              label="Total Amount"
              required
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="0.00"
              prefix={PAYMENT_CURRENCY_SYMBOL}
              helperText={`${PAYMENT_CURRENCY_CODE} — up to two decimal places`}
              error={fieldError('total_amount')}
              {...register('total_amount')}
            />

            <Controller
              control={control}
              name="payment_date"
              render={({ field }) => (
                <DatePicker
                  label="Payment Date"
                  required
                  value={field.value || undefined}
                  onChange={field.onChange}
                  error={fieldError('payment_date')}
                />
              )}
            />

            <div className="md:col-span-2">
              <Input
                label="Reference Number"
                placeholder="Transaction or cheque reference"
                maxLength={PAYMENT_REFERENCE_MAX_LENGTH}
                helperText="Optional"
                error={fieldError('reference_number')}
                {...register('reference_number')}
              />
            </div>

            <div className="md:col-span-2">
              <Textarea
                label="Notes"
                placeholder="Optional notes for this payment…"
                maxLength={PAYMENT_NOTES_MAX_LENGTH}
                showCharCount
                error={fieldError('notes')}
                {...register('notes')}
              />
            </div>

            <div className="md:col-span-2 rounded-lg border border-info/25 bg-info/5 p-3">
              <p className="flex items-start gap-2 text-body-sm text-info">
                <Icon icon={Info} size="sm" className="mt-0.5 shrink-0" />
                The payment is created as pending. Complete it before
                allocating to invoices or generating a receipt.
              </p>
            </div>
          </div>
        </Drawer.Body>

        <Drawer.Footer>
          <FormActions
            onCancel={onClose}
            submitting={submitting}
            submitDisabled={submitting || !isValid}
            submitText="Save payment"
            cancelDisabled={submitting}
          />
        </Drawer.Footer>
      </Form>
    </Drawer>
  );
};
