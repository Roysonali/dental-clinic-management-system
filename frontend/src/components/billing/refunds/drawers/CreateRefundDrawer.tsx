import { useEffect, useMemo, type FC } from 'react';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, Info } from 'lucide-react';
import { Drawer } from '../../../common/Drawer/Drawer';
import { IconButton } from '../../../common/Button/IconButton';
import { Icon } from '../../../common/Icon/Icon';
import { Form, FormActions, ValidationSummary } from '../../../common/Form';
import { Textarea } from '../../../common/Input';
import { PAYMENT_CURRENCY_CODE, REFUND_REASON_MAX_LENGTH } from '../../../../constants/billing';
import {
  createRefundFormSchema,
  parseRefundMoney,
  type RefundFormValues,
} from '../../../../utils/refundFormSchema';
import { defaultRefundFormValues } from '../../../../utils/refundFormUtils';
import { formatRefundAmount } from '../../../../utils/refundFormatting';
import type { PaymentRead } from '../../../../types/billing';

interface CreateRefundDrawerProps {
  open: boolean;
  /** The completed payment being refunded (fixed by context). */
  payment: PaymentRead | null;
  onClose: () => void;
  onSubmit: (values: RefundFormValues) => void;
  submitting?: boolean;
  serverErrors?: Record<string, string>;
  serverMessage?: string | null;
}

/**
 * CreateRefundDrawer — create-refund workflow (Sprint 14A.5, reference §14).
 *
 * Right-side drawer (~44vw desktop, near-full width on small screens) over
 * the payment detail page: fixed header, independently scrolling body, sticky
 * footer. The payment is fixed by context (the drawer opens from a specific
 * payment), so the PAYMENT field renders as a disabled dropdown.
 *
 * The financial box and the "Remaining after this refund" hint are computed
 * from the REAL payment aggregate (total_amount, financials.refunded_amount)
 * — never fake numbers. The backend remains the authority on the amount
 * limit (RefundExceedsPayment).
 */
export const CreateRefundDrawer: FC<CreateRefundDrawerProps> = ({
  open,
  payment,
  onClose,
  onSubmit,
  submitting = false,
  serverErrors = {},
  serverMessage = null,
}) => {
  const alreadyRefunded = useMemo(
    () => (payment ? Math.max(0, Number(payment.financials.refunded_amount)) : 0),
    [payment],
  );
  const paymentTotal = useMemo(
    () => (payment ? Math.max(0, Number(payment.total_amount)) : 0),
    [payment],
  );
  const refundableBalance = Math.max(0, paymentTotal - alreadyRefunded);

  const {
    handleSubmit,
    control,
    reset,
    formState: { errors, isValid },
  } = useForm<RefundFormValues>({
    resolver: zodResolver(createRefundFormSchema(refundableBalance)),
    mode: 'onChange',
    defaultValues: defaultRefundFormValues(payment?.id ?? ''),
  });

  // Fresh form each time the drawer opens (payment may change).
  useEffect(() => {
    if (open) reset(defaultRefundFormValues(payment?.id ?? ''));
  }, [open, reset, payment?.id]);

  const watchedAmount = useWatch({ control, name: 'amount' });
  const parsedAmount = parseRefundMoney(watchedAmount);
  const remainingAfter = useMemo(() => {
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) return null;
    return Math.max(0, refundableBalance - parsedAmount);
  }, [parsedAmount, refundableBalance]);

  const fieldError = (field: keyof RefundFormValues) =>
    errors[field]?.message ?? serverErrors[field];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      position="right"
      size="lg"
      ariaLabel="Create refund"
      className="!max-w-[44vw] min-w-[500px] max-sm:!max-w-full max-sm:min-w-0"
    >
      <Form onSubmit={handleSubmit(onSubmit)} className="flex h-full flex-col">
        <Drawer.Header>
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-h3 font-semibold tracking-tight text-neutral-900">Create refund</h2>
              <p className="text-caption text-neutral-500">
                Saved as PENDING · number RFD-##### assigned on save
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

          <ValidationSummary errors={{ ...serverErrors, ...errors }} title="A few fields need attention before this refund can be saved:" />

          <div className="mt-4 grid grid-cols-1 gap-4">
            {/* Payment — fixed by context */}
            <div>
              <label
                htmlFor="refund-payment"
                className="mb-1.5 block text-caption font-medium uppercase tracking-wide text-neutral-500"
              >
                Payment <span className="text-danger">*</span>
              </label>
              <select
                id="refund-payment"
                className="w-full cursor-not-allowed rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-body text-neutral-600"
                value={payment?.id ?? ''}
                disabled
                aria-label="Payment"
              >
                {payment && (
                  <option value={payment.id}>
                    {payment.payment_number} · {payment.patient.full_name} ·{' '}
                    {formatRefundAmount(payment.total_amount, PAYMENT_CURRENCY_CODE)}
                  </option>
                )}
              </select>
              <p className="mt-1 text-caption text-neutral-400">
                Completed payments with a refundable balance.
              </p>
            </div>

            {/* Financial information box */}
            <div className="rounded-lg border border-neutral-200 bg-neutral-50/60 px-4 py-3">
              <div className="grid grid-cols-1 gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-caption font-medium uppercase tracking-wide text-neutral-500">Payment total</span>
                  <span className="text-body-sm font-semibold text-neutral-900 tabular-nums">
                    {formatRefundAmount(payment?.total_amount, PAYMENT_CURRENCY_CODE)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-caption font-medium uppercase tracking-wide text-neutral-500">Already refunded</span>
                  <span className="text-body-sm font-semibold text-neutral-900 tabular-nums">
                    {formatRefundAmount(alreadyRefunded, PAYMENT_CURRENCY_CODE)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-caption font-medium uppercase tracking-wide text-neutral-500">Refundable balance</span>
                  <span className="text-body-sm font-bold text-primary-700 tabular-nums">
                    {formatRefundAmount(refundableBalance, PAYMENT_CURRENCY_CODE)}
                  </span>
                </div>
              </div>
            </div>

            {/* Refund amount */}
            <Controller
              control={control}
              name="amount"
              render={({ field }) => (
                <div>
                  <label htmlFor={field.name} className="mb-1.5 block text-caption font-medium uppercase tracking-wide text-neutral-500">
                    Refund amount <span className="text-danger">*</span>
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
                    aria-describedby={
                      fieldError('amount') ? `${field.name}-error` : 'refund-amount-hint'
                    }
                  />
                  {fieldError('amount') ? (
                    <p id={`${field.name}-error`} className="mt-1 text-body-sm text-danger">
                      {fieldError('amount')}
                    </p>
                  ) : (
                    <p id="refund-amount-hint" className="mt-1 text-caption text-neutral-400">
                      {remainingAfter !== null
                        ? `Remaining after this refund: ${formatRefundAmount(remainingAfter, PAYMENT_CURRENCY_CODE)}`
                        : `${PAYMENT_CURRENCY_CODE} — up to two decimal places`}
                    </p>
                  )}
                </div>
              )}
            />

            {/* Reason */}
            <Controller
              control={control}
              name="reason"
              render={({ field }) => (
                <Textarea
                  label="Reason"
                  required
                  placeholder="Why is this refund being requested?"
                  maxLength={REFUND_REASON_MAX_LENGTH}
                  showCharCount
                  error={fieldError('reason')}
                  {...field}
                />
              )}
            />

            {/* Informational box */}
            <div className="rounded-lg border border-info/25 bg-info/5 p-3">
              <p className="flex items-start gap-2 text-body-sm text-info">
                <Icon icon={Info} size="sm" className="mt-0.5 shrink-0" />
                A refund must be approved before it can be completed.
              </p>
            </div>
          </div>
        </Drawer.Body>

        <Drawer.Footer>
          <FormActions
            onCancel={onClose}
            submitting={submitting}
            submitDisabled={submitting || !isValid}
            submitText="Create refund"
            cancelDisabled={submitting}
          />
        </Drawer.Footer>
      </Form>
    </Drawer>
  );
};
