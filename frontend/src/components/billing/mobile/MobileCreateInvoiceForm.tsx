import { useEffect, type FC } from 'react';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X } from 'lucide-react';
import { Drawer } from '../../common/Drawer/Drawer';
import { IconButton } from '../../common/Button/IconButton';
import { Icon } from '../../common/Icon/Icon';
import { Button } from '../../common/Button/Button';
import { Form, ValidationSummary } from '../../common/Form';
import { DatePicker, Textarea } from '../../common/Input';
import { PatientPicker } from '../../appointments/PatientPicker';
import { MobileLineItemsEditor } from './MobileLineItemsEditor';
import { INVOICE_NOTES_MAX_LENGTH } from '../../../constants/billing';
import {
  invoiceCreateFormSchema,
  type InvoiceCreateFormValues,
} from '../../../utils/invoiceFormSchema';
import { defaultCreateInvoiceValues } from '../../../utils/invoiceFormUtils';

interface MobileCreateInvoiceFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: InvoiceCreateFormValues) => void;
  submitting?: boolean;
  serverErrors?: Record<string, string>;
  serverMessage?: string | null;
}

/**
 * MobileCreateInvoiceForm — reference mobile New Invoice screen (49).
 *
 * A full-screen form (NOT the desktop two-column drawer) with a compact
 * header ("New invoice / Draft — number assigned on issue" + close), a
 * single-column body (Patient → Due Date → Notes → line-item card → Grand
 * Total) and a fixed footer with Cancel + Save draft.
 *
 * Uses the SAME form schema and conversion utilities as the desktop drawer
 * (invoiceCreateFormSchema / defaultCreateInvoiceValues / line-item utils),
 * so the exact same backend payload is produced — only the presentation
 * differs. Secondary desktop fields that the reference hides (doctor /
 * treatment plan / appointment / currency) are omitted visually; their
 * form values keep the schema defaults (no backend capability removed).
 */
export const MobileCreateInvoiceForm: FC<MobileCreateInvoiceFormProps> = ({
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
  } = useForm<InvoiceCreateFormValues>({
    resolver: zodResolver(invoiceCreateFormSchema),
    mode: 'onChange',
    defaultValues: defaultCreateInvoiceValues(),
  });

  // Fresh form each time the form opens (defaults recompute: today + 30d).
  useEffect(() => {
    if (open) reset(defaultCreateInvoiceValues());
  }, [open, reset]);

  const watchedInvoiceDate = useWatch({ control, name: 'invoice_date' });

  const fieldError = (field: keyof InvoiceCreateFormValues) =>
    errors[field]?.message ?? serverErrors[field];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      position="right"
      size="full"
      ariaLabel="New invoice"
      className="!max-w-full"
    >
      <Form onSubmit={handleSubmit(onSubmit)} className="flex h-full flex-col">
        <Drawer.Header>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-2xl font-bold tracking-tight text-neutral-900">New invoice</h2>
              <p className="mt-0.5 text-sm text-neutral-500">Draft — number assigned on issue</p>
            </div>
            <IconButton
              icon={<Icon icon={X} size="md" />}
              aria-label="Close"
              variant="ghost"
              className="h-11 w-11 shrink-0 rounded-xl border border-neutral-300 bg-white text-neutral-600"
              onClick={onClose}
            />
          </div>
        </Drawer.Header>

        <Drawer.Body>
          {serverMessage && (
            <div role="alert" className="mb-4 rounded-xl border border-danger/25 bg-danger/10 p-4">
              <p className="text-body-sm text-danger">{serverMessage}</p>
            </div>
          )}

          <ValidationSummary errors={{ ...serverErrors, ...errors }} title="A few fields need attention before this draft can be saved:" />

          <div className="mt-4 flex flex-col gap-5">
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
              name="due_date"
              render={({ field }) => (
                <DatePicker
                  label="Due Date"
                  required
                  value={field.value || undefined}
                  onChange={field.onChange}
                  error={fieldError('due_date')}
                  minDate={watchedInvoiceDate || undefined}
                  helperText="Invoice date + 30 days."
                />
              )}
            />

            <div>
              <Textarea
                label="Notes"
                placeholder="Visible on the invoice"
                maxLength={INVOICE_NOTES_MAX_LENGTH}
                showCharCount
                error={fieldError('notes')}
                {...register('notes')}
              />
            </div>

            <MobileLineItemsEditor control={control} register={register} errors={errors} />
          </div>
        </Drawer.Body>

        <Drawer.Footer className="!bg-white">
          <div className="flex w-full items-center justify-end gap-3">
            <Button type="button" variant="secondary" size="lg" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={submitting}
              disabled={submitting || !isValid}
            >
              Save draft
            </Button>
          </div>
        </Drawer.Footer>
      </Form>
    </Drawer>
  );
};
