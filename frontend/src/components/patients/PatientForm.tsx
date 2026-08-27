import { type FC } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormActions, ValidationSummary } from '../common/Form';
import { Input, Select, Textarea, DatePicker } from '../common/Input';
import { PATIENT_GENDERS, PATIENT_GENDER_LABELS, PATIENT_NAME_PATTERN, PATIENT_PHONE_PATTERN } from '../../constants/patient';
import type { PatientFormValues } from '../../types/patient';

/* ── Zod schema — mirrors backend PatientValidators + PatientBase ───── */

const nameMessages = {
  min: (label: string) => `${label} must be at least 2 characters`,
  max: (label: string) => `${label} must be at most 100 characters`,
  chars: 'Name should contain only alphabetic characters, spaces, hyphens, and apostrophes.',
};

const nameField = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .min(2, nameMessages.min(label))
    .max(100, nameMessages.max(label))
    .regex(PATIENT_NAME_PATTERN, nameMessages.chars);

const optionalNameField = (label: string) =>
  z.union([z.literal(''), z.string().trim().max(100, nameMessages.max(label)).regex(PATIENT_NAME_PATTERN, nameMessages.chars)]);

const phoneRule = {
  required: 'Primary contact number is required',
  invalid: 'Phone must be 10–15 digits with an optional leading +',
};

const requiredPhone = z
  .string()
  .trim()
  .min(1, phoneRule.required)
  .regex(PATIENT_PHONE_PATTERN, phoneRule.invalid);

const optionalPhone = z
  .union([z.literal(''), z.string().trim().regex(PATIENT_PHONE_PATTERN, phoneRule.invalid)]);

const optionalEmail = z
  .union([z.literal(''), z.string().trim().email('Please enter a valid email address')]);

const optionalLongText = (max: number, label: string) =>
  z.union([z.literal(''), z.string().trim().max(max, `${label} must be at most ${max} characters`)]);

const patientFormSchema = z.object({
  first_name: nameField('First name'),
  middle_name: optionalNameField('Middle name'),
  last_name: nameField('Last name'),
  date_of_birth: z
    .string()
    .min(1, 'Date of birth is required')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth is invalid')
    .refine((value) => {
      const year = Number(value.slice(0, 4));
      return year >= 1900;
    }, 'Date of birth is invalid')
    .refine((value) => {
      // Backend rule: date of birth cannot be in the future.
      const [y, m, d] = value.split('-').map(Number);
      const dob = new Date(y, m - 1, d);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return dob <= today;
    }, 'Date of birth cannot be in the future.'),
  gender: z
    .string()
    .min(1, 'Gender is required')
    .refine((value) => (PATIENT_GENDERS as readonly string[]).includes(value), 'Gender is invalid'),
  primary_contact_number: requiredPhone,
  emergency_contact_number: optionalPhone,
  email: optionalEmail,
  address: optionalLongText(500, 'Address'),
  remarks: optionalLongText(1000, 'Remarks'),
});

/* ── Props ──────────────────────────────────────────────────────────── */

interface PatientFormProps {
  /** Called with validated form values */
  onSubmit: (values: PatientFormValues) => void;
  /** Show loading state on the submit button */
  submitting?: boolean;
  /** Submit button label */
  submitText?: string;
  /** Called when cancel is clicked */
  onCancel?: () => void;
  /** Pre-fill values (edit mode) */
  initialValues?: Partial<PatientFormValues>;
  /** Server-side field errors (snake_case keys) injected into the form */
  serverErrors?: Record<string, string>;
  /** Server-level error banner message */
  serverMessage?: string | null;
  /** Disable the entire form (e.g. while initial data loads) */
  disabled?: boolean;
}

const GENDER_OPTIONS = PATIENT_GENDERS.map((g) => ({
  value: g,
  label: PATIENT_GENDER_LABELS[g],
}));

/**
 * PatientForm — presentational create/edit form.
 *
 * Pure: no API calls, no navigation. The container owns submission and
 * server errors. Validation rules mirror the backend exactly (name charset,
 * phone pattern, DOB range, field lengths). Both Create and Edit reuse this
 * single form — there is no duplicated form logic.
 */
export const PatientForm: FC<PatientFormProps> = ({
  onSubmit,
  submitting = false,
  submitText = 'Save Patient',
  onCancel,
  initialValues,
  serverErrors = {},
  serverMessage = null,
  disabled = false,
}) => {
  const form = useForm<PatientFormValues>({
    resolver: zodResolver(patientFormSchema),
    mode: 'onTouched',
    defaultValues: {
      first_name: '',
      middle_name: '',
      last_name: '',
      date_of_birth: '',
      gender: '',
      primary_contact_number: '',
      emergency_contact_number: '',
      email: '',
      address: '',
      remarks: '',
      ...initialValues,
    },
  });

  const { register, handleSubmit, control, formState: { errors } } = form;

  /** Merge client + server field errors for display. */
  const fieldError = (field: string) =>
    errors[field as keyof PatientFormValues]?.message ?? serverErrors[field];

  return (
    <div className="flex flex-col gap-4">
      {serverMessage && (
        <div role="alert" className="rounded-lg border border-danger/25 bg-danger/10 p-4">
          <p className="text-body-sm text-danger">{serverMessage}</p>
        </div>
      )}

      <ValidationSummary errors={errors} title="Please review the following fields:" />

      <Form grid columns={2} spacing="md" onSubmit={handleSubmit(onSubmit)}>
        {/* ── Personal Information ─────────────────────── */}
        <Input
          label="First Name"
          placeholder="Juan"
          required
          disabled={disabled}
          error={fieldError('first_name')}
          {...register('first_name')}
        />
        <Input
          label="Middle Name"
          placeholder="Reyes"
          disabled={disabled}
          error={fieldError('middle_name')}
          {...register('middle_name')}
        />
        <Input
          label="Last Name"
          placeholder="Dela Cruz"
          required
          disabled={disabled}
          error={fieldError('last_name')}
          {...register('last_name')}
        />
        <Controller
          control={control}
          name="date_of_birth"
          render={({ field }) => (
            <DatePicker
              label="Date of Birth"
              required
              disabled={disabled}
              error={fieldError('date_of_birth')}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
        <Select
          label="Gender"
          required
          placeholder="Select gender"
          disabled={disabled}
          options={GENDER_OPTIONS}
          error={fieldError('gender')}
          {...register('gender')}
        />

        {/* ── Contact Information ──────────────────────── */}
        <Input
          label="Primary Contact Number"
          placeholder="+639123456789"
          required
          disabled={disabled}
          inputMode="tel"
          error={fieldError('primary_contact_number')}
          {...register('primary_contact_number')}
        />
        <Input
          label="Emergency Contact Number"
          placeholder="+639987654321"
          disabled={disabled}
          inputMode="tel"
          error={fieldError('emergency_contact_number')}
          {...register('emergency_contact_number')}
        />
        <Input
          label="Email Address"
          placeholder="juan.delacruz@email.com"
          disabled={disabled}
          type="email"
          inputMode="email"
          autoComplete="email"
          error={fieldError('email')}
          {...register('email')}
        />

        {/* ── Address & Remarks ────────────────────────── */}
        <Textarea
          label="Address"
          placeholder="123 Rizal St., Barangay San Isidro, Manila"
          disabled={disabled}
          className="md:col-span-2"
          error={fieldError('address')}
          {...register('address')}
        />
        <Textarea
          label="Remarks"
          placeholder="Allergic to penicillin."
          disabled={disabled}
          className="md:col-span-2"
          error={fieldError('remarks')}
          {...register('remarks')}
        />

        <FormActions
          onCancel={onCancel}
          submitting={submitting}
          submitText={submitText}
          className="md:col-span-2"
        />
      </Form>
    </div>
  );
};
