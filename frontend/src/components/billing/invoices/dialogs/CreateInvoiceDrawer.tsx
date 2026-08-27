import { useEffect, useMemo, useRef, type FC } from 'react';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X } from 'lucide-react';
import { Drawer } from '../../../common/Drawer/Drawer';
import { IconButton } from '../../../common/Button/IconButton';
import { Icon } from '../../../common/Icon/Icon';
import { Form, FormActions, ValidationSummary } from '../../../common/Form';
import { Select, Textarea, DatePicker } from '../../../common/Input';
import { PatientPicker } from '../../../appointments/PatientPicker';
import { LineItemsEditor } from '../LineItemsEditor';
import { useDoctors } from '../../../../hooks/doctors/useDoctors';
import { useTreatmentPlans } from '../../../../hooks/treatmentPlans/useTreatmentPlans';
import { useAppointmentOptions } from '../../../../hooks/patientRecords/useAppointmentOptions';
import {
  INVOICE_NOTES_MAX_LENGTH,
  CURRENCY_OPTIONS,
  PAYMENT_CURRENCY_CODE,
} from '../../../../constants/billing';
import {
  invoiceCreateFormSchema,
  type InvoiceCreateFormValues,
} from '../../../../utils/invoiceFormSchema';
import { defaultCreateInvoiceValues, previewGrandTotal } from '../../../../utils/invoiceFormUtils';
import { formatCurrency } from '../../../../utils/formatting';

interface CreateInvoiceDrawerProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: InvoiceCreateFormValues) => void;
  submitting?: boolean;
  serverErrors?: Record<string, string>;
  serverMessage?: string | null;
  /** Pre-fill the patient when opened from the patient profile. */
  initialPatientId?: string;
  /** Human-readable patient label to display in the picker (e.g. "Juan Dela Cruz (PAT-000001)"). */
  selectedPatientLabel?: string;
}

/** Doctor dropdown options (active doctors) — provided by the container. */
type DoctorOptions = { value: string; label: string }[];

/**
 * CreateInvoiceDrawer — create-draft-invoice workflow (Sprint 14A.2).
 *
 * Drawer ≈ 40–45% viewport width on desktop (xl preset), sticky footer,
 * internally scrolling body. The whole drawer — including the sticky footer —
 * is wrapped in a single `<Form>` so the footer's submit button is a form
 * descendant (HTML submit semantics) while the footer stays pinned.
 *
 * Fields map exactly to backend `InvoiceCreateRequest`: patient (required),
 * optional treatment plan / appointment / doctor, currency, invoice date +
 * due date (due >= invoice), notes (<= 2000), and line items. The line-item
 * editor mirrors backend item bounds; the net-amount preview follows the
 * backend formula and is never authoritative. Save stays disabled while the
 * form is invalid or a request is in flight (no duplicate submissions).
 *
 * Business relationships:
 * - Appointment depends on Patient (filtered by patient_id)
 * - Treatment Plan depends on Patient (filtered by patient_id)
 * - Doctor is independent
 * - Clearing Patient cascades to clear Appointment and Treatment Plan
 */
export const CreateInvoiceDrawer: FC<CreateInvoiceDrawerProps> = ({
  open,
  onClose,
  onSubmit,
  submitting = false,
  serverErrors = {},
  serverMessage = null,
  initialPatientId = '',
  selectedPatientLabel,
}) => {
  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors, isValid },
  } = useForm<InvoiceCreateFormValues>({
    resolver: zodResolver(invoiceCreateFormSchema),
    mode: 'onChange',
    defaultValues: defaultCreateInvoiceValues(),
  });

  // Fresh form each time the drawer opens (defaults recompute: today + 30d).
  useEffect(() => {
    if (open) {
      const defaults = defaultCreateInvoiceValues();
      reset(
        initialPatientId
          ? { ...defaults, patient_id: initialPatientId }
          : defaults,
      );
    }
  }, [open, reset, initialPatientId]);

  // useWatch (not form.watch) so React Compiler can memoize the drawer.
  const watchedPatientId = useWatch({ control, name: 'patient_id' });
  const watchedItems = useWatch({ control, name: 'items' });
  const watchedInvoiceDate = useWatch({ control, name: 'invoice_date' });

  // Track the previous patient id so we can cascade-clear dependent fields
  // when the patient changes. Using useWatch + useEffect avoids mutating
  // form state inside the onChange handler (which can race with validation).
  const prevPatientRef = useRef(watchedPatientId);
  useEffect(() => {
    if (prevPatientRef.current !== watchedPatientId) {
      setValue('appointment_id', '');
      setValue('treatment_plan_id', '');
      prevPatientRef.current = watchedPatientId;
    }
  }, [watchedPatientId, setValue, prevPatientRef]);

  const doctorsQuery = useDoctors();
  const planOptionsQuery = useTreatmentPlans(
    {
      page: 1,
      page_size: 100,
      sort_by: 'created_at',
      sort_order: 'desc',
      ...(watchedPatientId ? { patient_id: watchedPatientId } : {}),
    },
    open,
  );
  const appointments = useAppointmentOptions(watchedPatientId, open && watchedPatientId !== '');

  const doctorOptions: DoctorOptions = useMemo(
    () =>
      (doctorsQuery.data?.items ?? []).map((d) => ({
        value: d.id,
        label: d.user_full_name ?? `Doctor #${d.id}`,
      })),
    [doctorsQuery.data?.items],
  );

  const planOptions = useMemo(
    () =>
      (planOptionsQuery.data?.items ?? []).map((plan) => ({
        value: plan.id,
        label: plan.plan_code,
      })),
    [planOptionsQuery.data?.items],
  );

  const fieldError = (field: keyof InvoiceCreateFormValues) =>
    errors[field]?.message ?? serverErrors[field];

  const combinedValidation = useMemo<Record<string, unknown>>(
    () => ({ ...serverErrors, ...errors }),
    [errors, serverErrors],
  );

  return (
    <Drawer
      open={open}
      onClose={onClose}
      position="right"
      size="xl"
      ariaLabel="New invoice"
      className="!max-w-[46vw] min-w-[520px] max-sm:!max-w-full max-sm:min-w-0"
    >
      <Form onSubmit={handleSubmit(onSubmit)} className="flex h-full flex-col">
        <Drawer.Header>
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-h3 font-semibold tracking-tight text-neutral-900">New invoice</h2>
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

          <ValidationSummary errors={combinedValidation} title="A few fields need attention before this draft can be saved:" />

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
                  wrapperClassName="md:col-span-2"
                  selectedLabel={selectedPatientLabel}
                />
              )}
            />

            <Controller
              control={control}
              name="treatment_plan_id"
              render={({ field }) => (
                <Select
                  label="Treatment Plan"
                  placeholder={planOptionsQuery.isLoading ? 'Loading plans…' : 'Select treatment plan'}
                  options={planOptions}
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  onClear={() => field.onChange('')}
                  clearable
                  disabled={planOptionsQuery.isLoading}
                  helperText={
                    !planOptionsQuery.isLoading && planOptions.length === 0 && watchedPatientId
                      ? 'No treatment plans found for this patient'
                      : 'Optional — originating treatment plan'
                  }
                />
              )}
            />

            <Controller
              control={control}
              name="appointment_id"
              render={({ field }) => (
                <Select
                  label="Appointment"
                  placeholder={
                    watchedPatientId === ''
                      ? 'Select a patient first'
                      : appointments.loading
                        ? 'Loading appointments…'
                        : 'Select appointment'
                  }
                  options={appointments.options}
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  onClear={() => field.onChange('')}
                  clearable
                  disabled={watchedPatientId === '' || appointments.loading}
                  helperText={
                    watchedPatientId === ''
                      ? 'Optional — appointments for the selected patient'
                      : !appointments.loading && appointments.options.length === 0
                        ? 'No appointments found for this patient'
                        : 'Optional — appointments for the selected patient'
                  }
                />
              )}
            />

            <Controller
              control={control}
              name="doctor_id"
              render={({ field }) => (
                <Select
                  label="Doctor"
                  placeholder={doctorsQuery.isLoading ? 'Loading doctors…' : 'Select doctor'}
                  options={doctorOptions}
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  onClear={() => field.onChange('')}
                  clearable
                  disabled={doctorsQuery.isLoading}
                  error={serverErrors.doctor_id}
                  helperText="Optional — treating doctor"
                />
              )}
            />

            <Controller
              control={control}
              name="currency_code"
              render={({ field }) => (
                <Select
                  label="Currency"
                  options={CURRENCY_OPTIONS}
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  helperText="Invoices display in INR"
                />
              )}
            />

            <Controller
              control={control}
              name="invoice_date"
              render={({ field }) => (
                <DatePicker
                  label="Invoice Date"
                  required
                  value={field.value || undefined}
                  onChange={field.onChange}
                  error={fieldError('invoice_date')}
                />
              )}
            />

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
                  minDate={watchedInvoiceDate || undefined}
                  helperText="Defaults to 30 days after the invoice date"
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

            <div className="md:col-span-2">
              <LineItemsEditor control={control} register={register} errors={errors} />
            </div>

            <div className="md:col-span-2">
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-body-sm font-medium text-neutral-600">Preview grand total</p>
                  <p className="text-h4 font-semibold text-neutral-900 tabular-nums">
                    {formatCurrency(previewGrandTotal(watchedItems ?? []), PAYMENT_CURRENCY_CODE)}
                  </p>
                </div>
                <p className="mt-0.5 text-caption text-neutral-400">
                  Preview only — the backend computes authoritative totals.
                </p>
              </div>
            </div>
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
