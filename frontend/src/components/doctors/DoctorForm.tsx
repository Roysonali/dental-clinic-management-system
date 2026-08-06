import type { FC, ReactNode } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormActions, ValidationSummary } from '../common/Form';
import { Input, Select, Textarea, DatePicker } from '../common/Input';
import { UserSearchSelect } from '../common/UserSearchSelect/UserSearchSelect';
import {
  DOCTOR_GENDERS,
  DOCTOR_GENDER_LABELS,
  MAX_CONSULTATION_DURATION,
  MAX_YEARS_EXPERIENCE,
  MIN_CONSULTATION_DURATION,
  MIN_YEARS_EXPERIENCE,
} from '../../constants/doctor';
import { doctorFormSchema } from '../../utils/doctorFormSchema';
import type { DoctorFormValues } from '../../types/doctor';

interface DoctorFormProps {
  /** Create vs edit mode (the user picker only renders in create) */
  mode: 'create' | 'edit';
  /** Called with validated form values */
  onSubmit: (values: DoctorFormValues) => void;
  /** Show loading state on the submit button */
  submitting?: boolean;
  /** Submit button label */
  submitText?: string;
  /** Called when cancel is clicked */
  onCancel?: () => void;
  /** Pre-fill values (edit mode) */
  initialValues?: Partial<DoctorFormValues>;
  /** Server-side field errors (snake_case keys) injected into the form */
  serverErrors?: Record<string, string>;
  /** Server-level error banner message */
  serverMessage?: string | null;
  /** Disable the entire form (e.g. while initial data loads) */
  disabled?: boolean;
}

const GENDER_OPTIONS = DOCTOR_GENDERS.map((g) => ({
  value: g,
  label: DOCTOR_GENDER_LABELS[g],
}));

const LANGUAGES_HELPER = 'Separate languages with commas (e.g. English, Filipino).';

/** Full-width group heading inside the two-column form grid. */
function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <div className="md:col-span-2">
      <h3 className="text-caption font-semibold uppercase tracking-wider text-neutral-400">
        {children}
      </h3>
    </div>
  );
}

/**
 * DoctorForm — presentational create/edit form.
 *
 * Pure: no API calls, no navigation. The container owns submission and
 * server errors. Validation mirrors the backend exactly (doctor phone
 * pattern, registration normalization, DOB range, field bounds). The user
 * picker (shared UserSearchSelect) is required in create mode and hidden
 * in edit mode — identity is resolved from the linked user by the backend.
 */
export const DoctorForm: FC<DoctorFormProps> = ({
  mode,
  onSubmit,
  submitting = false,
  submitText = 'Save Doctor',
  onCancel,
  initialValues,
  serverErrors = {},
  serverMessage = null,
  disabled = false,
}) => {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<DoctorFormValues>({
    resolver: zodResolver(doctorFormSchema),
    mode: 'onTouched',
    defaultValues: {
      user_id: '',
      date_of_birth: '',
      gender: '',
      primary_phone: '',
      address: '',
      qualification: '',
      registration_number: '',
      years_of_experience: '',
      consultation_fee: '',
      consultation_duration: '',
      languages_known: [],
      profile_photo_url: '',
      biography: '',
      emergency_contact_name: '',
      emergency_contact_phone: '',
      ...initialValues,
    },
  });

  /** Merge client + server field errors for display. */
  const fieldError = (field: string) =>
    errors[field as keyof DoctorFormValues]?.message ?? serverErrors[field];

  return (
    <div className="flex flex-col gap-4">
      {serverMessage && (
        <div role="alert" className="rounded-lg border border-danger/25 bg-danger/10 p-4">
          <p className="text-body-sm text-danger">{serverMessage}</p>
        </div>
      )}

      <ValidationSummary errors={errors} title="Please review the following fields:" />

      <Form grid columns={2} spacing="md" onSubmit={handleSubmit(onSubmit)}>
        {/* ── Identity (create only — resolved from the linked user) ── */}
        {mode === 'create' && (
          <Controller
            control={control}
            name="user_id"
            render={({ field }) => (
              <UserSearchSelect
                value={field.value}
                onChange={field.onChange}
                error={fieldError('user_id')}
                required
                disabled={disabled}
                wrapperClassName="md:col-span-2"
              />
            )}
          />
        )}

        {/* ── Personal & Contact Information ───────────────────────── */}
        <SectionHeading>Personal &amp; Contact Information</SectionHeading>
        <Controller
          control={control}
          name="date_of_birth"
          render={({ field }) => (
            <DatePicker
              label="Date of Birth"
              disabled={disabled}
              error={fieldError('date_of_birth')}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
        <Select
          label="Gender"
          placeholder="Select gender"
          disabled={disabled}
          options={GENDER_OPTIONS}
          error={fieldError('gender')}
          {...register('gender')}
        />
        <Input
          label="Primary Phone"
          placeholder="+639171234567"
          required
          disabled={disabled}
          inputMode="tel"
          error={fieldError('primary_phone')}
          {...register('primary_phone')}
        />
        <Input
          label="Profile Photo URL"
          placeholder="https://…"
          type="url"
          disabled={disabled}
          inputMode="url"
          error={fieldError('profile_photo_url')}
          {...register('profile_photo_url')}
        />
        <Textarea
          label="Address"
          placeholder="123 Rizal St., Manila"
          disabled={disabled}
          className="md:col-span-2"
          error={fieldError('address')}
          {...register('address')}
        />

        {/* ── Professional Information ─────────────────────────────── */}
        <SectionHeading>Professional Information</SectionHeading>
        <Input
          label="Qualification"
          placeholder="DMD, University of the Philippines"
          disabled={disabled}
          error={fieldError('qualification')}
          {...register('qualification')}
        />
        <Input
          label="Registration Number"
          placeholder="DEN-2020-12345"
          disabled={disabled}
          error={fieldError('registration_number')}
          {...register('registration_number')}
        />
        <Input
          label="Years of Experience"
          placeholder="10"
          type="number"
          min={MIN_YEARS_EXPERIENCE}
          max={MAX_YEARS_EXPERIENCE}
          disabled={disabled}
          inputMode="numeric"
          error={fieldError('years_of_experience')}
          {...register('years_of_experience')}
        />
        <Input
          label="Consultation Fee"
          placeholder="800.00"
          type="number"
          step="0.01"
          min="0.01"
          prefix="₱"
          disabled={disabled}
          inputMode="decimal"
          error={fieldError('consultation_fee')}
          {...register('consultation_fee')}
        />
        <Input
          label="Consultation Duration (minutes)"
          placeholder="30"
          type="number"
          min={MIN_CONSULTATION_DURATION}
          max={MAX_CONSULTATION_DURATION}
          disabled={disabled}
          inputMode="numeric"
          error={fieldError('consultation_duration')}
          {...register('consultation_duration')}
        />
        <Controller
          control={control}
          name="languages_known"
          render={({ field }) => (
            <Input
              label="Languages Known"
              placeholder="English, Filipino"
              helperText={LANGUAGES_HELPER}
              disabled={disabled}
              error={fieldError('languages_known')}
              value={field.value.join(', ')}
              onChange={(e) =>
                field.onChange(
                  e.target.value
                    .split(',')
                    .map((item) => item.trim())
                    .filter(Boolean),
                )
              }
            />
          )}
        />
        <Textarea
          label="Biography"
          placeholder="Professional biography…"
          disabled={disabled}
          className="md:col-span-2"
          error={fieldError('biography')}
          {...register('biography')}
        />

        {/* ── Emergency Contact ───────────────────────────────────── */}
        <SectionHeading>Emergency Contact</SectionHeading>
        <Input
          label="Emergency Contact Name"
          placeholder="Maria Dela Cruz"
          disabled={disabled}
          error={fieldError('emergency_contact_name')}
          {...register('emergency_contact_name')}
        />
        <Input
          label="Emergency Contact Phone"
          placeholder="+639177654321"
          disabled={disabled}
          inputMode="tel"
          error={fieldError('emergency_contact_phone')}
          {...register('emergency_contact_phone')}
        />

        {/* ── Sticky action bar (pinned while the body scrolls) ────── */}
        <div className="sticky bottom-0 -mt-1 flex items-center justify-end border-t border-neutral-200 bg-white pb-1 pt-4 md:col-span-2">
          <FormActions
            onCancel={onCancel}
            submitting={submitting}
            submitText={submitText}
            size="lg"
            fullWidth
            className="w-full"
          />
        </div>
      </Form>
    </div>
  );
};
