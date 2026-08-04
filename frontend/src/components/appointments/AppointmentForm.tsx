import type { FC } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormActions, ValidationSummary } from '../common/Form';
import { Select, Textarea, DatePicker, TimePicker } from '../common/Input';
import { PatientPicker } from './PatientPicker';
import { todayLocalISO } from '../../utils/date';
import {
  APPOINTMENT_DURATION_OPTIONS,
  APPOINTMENT_DEFAULT_DURATION,
  APPOINTMENT_TYPE_OPTIONS,
} from '../../constants/appointment';
import type { AppointmentFormValues } from '../../types/appointment';

/* ── Zod schema — mirrors backend AppointmentCreate/Update + constants ─ */

/** `HH:MM` → minutes-since-midnight (NaN when malformed). */
function parseMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : Number.NaN;
}

const appointmentFormSchema = z
  .object({
    patient_id: z.string().min(1, 'Patient is required'),
    dentist_id: z.string().min(1, 'Dentist is required'),
    appointment_date: z
      .string()
      .min(1, 'Appointment date is required')
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Appointment date is invalid'),
    start_time: z.string().min(1, 'Start time is required'),
    duration_minutes: z
      .string()
      .min(1, 'Duration is required')
      .refine(
        (v) => (APPOINTMENT_DURATION_OPTIONS as readonly number[]).includes(Number(v)),
        'Duration is invalid',
      ),
    appointment_type: z
      .string()
      .min(1, 'Appointment type is required')
      .refine(
        (v) => (APPOINTMENT_TYPE_OPTIONS as readonly string[]).includes(v),
        'Appointment type is invalid',
      ),
    reason_for_visit: z
      .string()
      .trim()
      .min(3, 'Reason for visit must be at least 3 characters')
      .max(500, 'Reason for visit must be at most 500 characters'),
    notes: z.union([
      z.literal(''),
      z.string().trim().max(5000, 'Notes must be at most 5000 characters'),
    ]),
  })
  // Mirrors backend AppointmentValidator: CLINIC_WORKING_DAYS (Mon–Sat) and
  // clinic sessions (10:00–13:00 or 17:00–21:00, end = start + duration).
  .superRefine((values, ctx) => {
    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(values.appointment_date);
    if (dateMatch) {
      const weekday = new Date(
        Number(dateMatch[1]),
        Number(dateMatch[2]) - 1,
        Number(dateMatch[3]),
      ).getDay();
      if (weekday === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['appointment_date'],
          message: 'The clinic is closed on Sundays.',
        });
      }
    }

    const start = parseMinutes(values.start_time);
    const duration = Number(values.duration_minutes);
    if (Number.isFinite(start) && Number.isFinite(duration)) {
      const end = start + duration;
      const morningSession = start >= 10 * 60 && end <= 13 * 60;
      const eveningSession = start >= 17 * 60 && end <= 21 * 60;
      if (!morningSession && !eveningSession) {
        ctx.addIssue({
          code: 'custom',
          path: ['start_time'],
          message:
            'Appointment must be within clinic hours (10:00 AM – 1:00 PM or 5:00 – 9:00 PM).',
        });
      }
    }
  });

/* ── Props ──────────────────────────────────────────────────────────── */

interface AppointmentFormProps {
  /** Called with validated form values */
  onSubmit: (values: AppointmentFormValues) => void;
  /** Show loading on the submit button */
  submitting?: boolean;
  /** Submit button label */
  submitText?: string;
  /** Called when cancel is clicked */
  onCancel?: () => void;
  /** Pre-fill values (edit mode) */
  initialValues?: Partial<AppointmentFormValues>;
  /** Server-side field errors (snake_case keys) */
  serverErrors?: Record<string, string>;
  /** Server-level error banner message */
  serverMessage?: string | null;
  /** Disable the entire form (e.g. while initial data loads) */
  disabled?: boolean;
  /** Dentist dropdown options (value = user_id as string) */
  dentistOptions: { value: string; label: string }[];
  /** Dentists still loading (disables the select) */
  dentistsLoading?: boolean;
  /** Dentists failed to load (helper note; current dentist still shown in edit) */
  dentistsError?: boolean;
  /** Whether the patient can be changed (create: true, edit: false) */
  patientEditable: boolean;
  /** Patient display name for the fixed-patient label (edit mode) */
  patientName?: string | null;
}

const DURATION_OPTIONS = APPOINTMENT_DURATION_OPTIONS.map((d) => ({
  value: String(d),
  label: `${d} min`,
}));

const TYPE_OPTIONS = APPOINTMENT_TYPE_OPTIONS.map((t) => ({ value: t, label: t }));

/**
 * AppointmentForm — presentational create/edit form.
 *
 * Pure apart from the self-contained PatientPicker (which owns its own
 * patient search query). The container owns submission, mutations and server
 * errors. Validation mirrors the backend: required ids, ISO date, working
 * days (Mon–Sat) and sessions (10:00–13:00 / 17:00–21:00), durations
 * (15/30/45/60) and type enum, 3–500 char reason, ≤5000 notes. Both Create
 * and Edit reuse this single form.
 */
export const AppointmentForm: FC<AppointmentFormProps> = ({
  onSubmit,
  submitting = false,
  submitText = 'Save Appointment',
  onCancel,
  initialValues,
  serverErrors = {},
  serverMessage = null,
  disabled = false,
  dentistOptions,
  dentistsLoading = false,
  dentistsError = false,
  patientEditable,
  patientName,
}) => {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentFormSchema),
    mode: 'onTouched',
    defaultValues: {
      patient_id: '',
      dentist_id: '',
      appointment_date: '',
      start_time: '',
      duration_minutes: String(APPOINTMENT_DEFAULT_DURATION),
      appointment_type: '',
      reason_for_visit: '',
      notes: '',
      ...initialValues,
    },
  });

  /** Merge client + server field errors for display. */
  const fieldError = (field: keyof AppointmentFormValues) =>
    errors[field]?.message ?? serverErrors[field];

  return (
    <div className="flex flex-col gap-4">
      {serverMessage && (
        <div role="alert" className="rounded-lg border border-danger/25 bg-danger/10 p-4">
          <p className="text-body-sm text-danger">{serverMessage}</p>
        </div>
      )}

      <ValidationSummary errors={errors} title="Please review the following fields:" />

      <Form grid columns={2} spacing="md" onSubmit={handleSubmit(onSubmit)}>
        {/* ── Schedule ──────────────────────────────────────── */}
        <Controller
          control={control}
          name="patient_id"
          render={({ field }) => (
            <PatientPicker
              value={field.value}
              onChange={field.onChange}
              error={fieldError('patient_id')}
              disabled={disabled || !patientEditable}
              selectedLabel={patientName}
              helperText={
                !patientEditable
                  ? 'The patient cannot be changed after booking.'
                  : undefined
              }
              required
              wrapperClassName="md:col-span-2"
            />
          )}
        />
        {dentistsError && (
          <div
            role="alert"
            className="rounded-lg border border-warning/30 bg-warning/10 p-3 md:col-span-2"
          >
            <p className="text-body-sm text-warning">
              The dentist list couldn&apos;t be loaded — this requires Admin or
              Receptionist access. If you&apos;re booking for yourself, ask a
              receptionist to schedule the appointment, or try again later.
            </p>
          </div>
        )}
        <Select
          label="Dentist"
          required
          placeholder={
            dentistsLoading ? 'Loading dentists…' : 'Select dentist'
          }
          disabled={disabled || dentistsLoading}
          options={dentistOptions}
          error={fieldError('dentist_id')}
          {...register('dentist_id')}
        />
        <Select
          label="Appointment Type"
          required
          placeholder="Select type"
          disabled={disabled}
          options={TYPE_OPTIONS}
          error={fieldError('appointment_type')}
          {...register('appointment_type')}
        />
        <Controller
          control={control}
          name="appointment_date"
          render={({ field }) => (
            <DatePicker
              label="Appointment Date"
              required
              disabled={disabled}
              error={fieldError('appointment_date')}
              value={field.value}
              onChange={field.onChange}
              minDate={todayLocalISO()}
            />
          )}
        />
        <Controller
          control={control}
          name="start_time"
          render={({ field }) => (
            <TimePicker
              label="Start Time"
              required
              disabled={disabled}
              error={fieldError('start_time')}
              value={field.value}
              onChange={field.onChange}
              stepMinutes={15}
              format="12h"
            />
          )}
        />
        <Select
          label="Duration"
          required
          placeholder="Select duration"
          disabled={disabled}
          options={DURATION_OPTIONS}
          error={fieldError('duration_minutes')}
          {...register('duration_minutes')}
        />

        {/* ── Details ─────────────────────────────────────────── */}
        <Textarea
          label="Reason for Visit"
          placeholder="e.g. Toothache on upper right molar, 2 weeks"
          required
          disabled={disabled}
          className="md:col-span-2"
          error={fieldError('reason_for_visit')}
          {...register('reason_for_visit')}
        />
        <Textarea
          label="Notes"
          placeholder="Additional instructions for the clinic staff…"
          disabled={disabled}
          className="md:col-span-2"
          error={fieldError('notes')}
          {...register('notes')}
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
