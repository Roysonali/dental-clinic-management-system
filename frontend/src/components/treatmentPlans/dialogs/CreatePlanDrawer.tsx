import type { FC } from 'react';
import { X } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Drawer } from '../../common/Drawer/Drawer';
import { IconButton } from '../../common/Button/IconButton';
import { Icon } from '../../common/Icon/Icon';
import { Form, FormActions, ValidationSummary } from '../../common/Form';
import { Select, Textarea, DatePicker } from '../../common/Input';
import { PatientPicker } from '../../appointments/PatientPicker';
import { Spinner } from '../../common/Spinner/Spinner';
import {
  createPlanFormSchema,
  defaultCreatePlanValues,
} from '../../../utils/treatmentPlanFormSchema';
import type { PlanFormValues } from '../../../types/treatmentPlan';

interface CreatePlanDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Pre-fill the patient when opened from the patient profile. */
  initialPatientId?: string;
  /** Doctor dropdown options (active doctors). */
  doctorOptions: { value: string; label: string }[];
  doctorsLoading?: boolean;
  doctorsError?: boolean;
  onSubmit: (values: PlanFormValues) => void;
  submitting?: boolean;
  serverErrors?: Record<string, string>;
  serverMessage?: string | null;
}

/**
 * CreatePlanDrawer — S-03 create-plan workflow ([MAP §3.3]).
 *
 * 680px drawer hosting the create-plan form: PatientPicker → Doctor select →
 * three clinical textareas → date range → optional plan_code (auto-assigned
 * `TXN-XXXXXX` when omitted). All header fields are CREATE-ONLY (O1) — this
 * is the only chance to set them, so every backend bound is mirrored in the
 * schema. Validation via zod + parseApiError field errors.
 */
export const CreatePlanDrawer: FC<CreatePlanDrawerProps> = ({
  open,
  onClose,
  initialPatientId = '',
  doctorOptions,
  doctorsLoading = false,
  doctorsError = false,
  onSubmit,
  submitting = false,
  serverErrors = {},
  serverMessage = null,
}) => {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<PlanFormValues>({
    resolver: zodResolver(createPlanFormSchema),
    mode: 'onTouched',
    defaultValues: { ...defaultCreatePlanValues, patient_id: initialPatientId },
  });

  const fieldError = (field: keyof PlanFormValues) =>
    errors[field]?.message ?? serverErrors[field];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      position="right"
      size="lg"
      ariaLabel="Create Treatment Plan"
      className="!max-w-[680px]"
    >
      <Drawer.Header>
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-h3 font-semibold tracking-tight text-neutral-900">Create Treatment Plan</h2>
            <p className="text-caption text-neutral-500">
              Plan details are set once and cannot be edited later (backend contract).
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

        <ValidationSummary errors={errors} title="Please review the following fields:" />

        <Form grid columns={2} spacing="md" onSubmit={handleSubmit(onSubmit)}>
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
              />
            )}
          />

          {doctorsError && (
            <div role="alert" className="rounded-lg border border-warning/30 bg-warning/10 p-3 md:col-span-2">
              <p className="text-body-sm text-warning">
                The doctor list couldn&apos;t be loaded — please try again later.
              </p>
            </div>
          )}
          <Select
            label="Doctor"
            required
            placeholder={doctorsLoading ? 'Loading doctors…' : 'Select doctor'}
            disabled={doctorsLoading}
            options={doctorOptions}
            error={fieldError('doctor_id')}
            {...register('doctor_id')}
          />

          <div className="md:col-span-2">
            <Textarea
              label="Clinical Notes"
              placeholder="Chief complaint, history, findings…"
              maxLength={5000}
              error={fieldError('clinical_notes')}
              {...register('clinical_notes')}
            />
          </div>
          <div className="md:col-span-2">
            <Textarea
              label="Observations"
              placeholder="Clinical observations…"
              maxLength={5000}
              error={fieldError('observations')}
              {...register('observations')}
            />
          </div>
          <div className="md:col-span-2">
            <Textarea
              label="Dentist Recommendations"
              placeholder="Recommended course of treatment…"
              maxLength={5000}
              error={fieldError('dentist_recommendations')}
              {...register('dentist_recommendations')}
            />
          </div>

          <Controller
            control={control}
            name="valid_from"
            render={({ field }) => (
              <DatePicker
                label="Valid From"
                error={fieldError('valid_from')}
                value={field.value || undefined}
                onChange={field.onChange}
              />
            )}
          />
          <Controller
            control={control}
            name="valid_to"
            render={({ field }) => (
              <DatePicker
                label="Valid To"
                error={fieldError('valid_to')}
                value={field.value || undefined}
                onChange={field.onChange}
              />
            )}
          />

          <div className="md:col-span-2">
            <input
              id="plan-code"
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-body text-neutral-800 transition-colors duration-150 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 hover:border-neutral-400"
              placeholder="Optional plan code (auto-generated as TXN-XXXXXX when blank)"
              maxLength={20}
              aria-invalid={!!fieldError('plan_code')}
              {...register('plan_code')}
            />
            {fieldError('plan_code') && (
              <p id="plan-code-error" className="mt-1 text-body-sm text-danger">
                {fieldError('plan_code')}
              </p>
            )}
          </div>

          <FormActions
            onCancel={onClose}
            submitting={submitting}
            submitText="Create Plan"
            className="md:col-span-2"
          />
        </Form>

        {doctorsLoading && (
          <div className="mt-4 flex items-center justify-center gap-2 text-caption text-neutral-400" role="status">
            <Spinner size="sm" variant="neutral" />
            Loading doctors…
          </div>
        )}
      </Drawer.Body>
    </Drawer>
  );
};
