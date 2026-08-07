import { useEffect, type FC } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Drawer } from '../../common/Drawer/Drawer';
import { IconButton } from '../../common/Button/IconButton';
import { Icon } from '../../common/Icon/Icon';
import { Button } from '../../common/Button/Button';
import { Form, FormActions, ValidationSummary } from '../../common/Form';
import { Select, Textarea } from '../../common/Input';
import { PatientPicker } from '../../appointments/PatientPicker';
import { useAppointmentOptions } from '../../../hooks/patientRecords/useAppointmentOptions';
import {
  defaultPatientRecordFormValues,
  patientRecordFormSchema,
} from '../../../utils/patientRecordFormSchema';
import {
  PATIENT_RECORD_CLINICAL_NOTES_MAX,
  PATIENT_RECORD_TEXT_MAX,
} from '../../../constants/patientRecord';
import type { PatientRecordFormValues } from '../../../types/patientRecord';

interface CreateRecordDrawerProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: PatientRecordFormValues) => void;
  submitting?: boolean;
  serverErrors?: Record<string, string>;
  serverMessage?: string | null;
  /** Set when the backend rejected creation with 409 (appointment already has a record). */
  conflictAppointmentId?: string | null;
  onViewConflictRecord?: (appointmentId: string) => void;
}

/**
 * CreateRecordDrawer — S-03 create-record workflow ([UI spec S-03]).
 *
 * 640px drawer: Record details (PatientPicker → Appointment selector
 * enabled only after a patient is chosen) · Clinical (chief complaint,
 * clinical notes, doctor remarks, treatment recommendation) · Medical
 * history (7 free-text fields). Every textarea carries a character counter
 * matching the backend limits. A 409 create conflict surfaces the server
 * message with a "View existing record" action (resolved via the real
 * by-appointment endpoint in the container).
 */
export const CreateRecordDrawer: FC<CreateRecordDrawerProps> = ({
  open,
  onClose,
  onSubmit,
  submitting = false,
  serverErrors = {},
  serverMessage = null,
  conflictAppointmentId = null,
  onViewConflictRecord,
}) => {
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<PatientRecordFormValues>({
    resolver: zodResolver(patientRecordFormSchema),
    mode: 'onTouched',
    defaultValues: defaultPatientRecordFormValues,
  });

  // M-1: the drawer stays mounted while closed, so React Hook Form keeps the
  // previous session's values. Re-seed a completely clean form on every open
  // (values, validation errors, dirty + touched flags — including the
  // selected patient so the appointment selector starts disabled).
  useEffect(() => {
    if (open) reset(defaultPatientRecordFormValues);
  }, [open, reset]);

  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form's watch() is safe for gating the appointment selector on patient selection; the rule is intentionally conservative.
  const selectedPatientId = watch('patient_id');
  // M-2: the appointment directory is only fetched once the drawer is open
  // AND a patient is chosen (and then cached) — no eager request on page mount.
  const { options: appointmentOptions, loading: appointmentsLoading, loaded: appointmentsLoaded } =
    useAppointmentOptions(selectedPatientId, open && selectedPatientId.length > 0);

  const fieldError = (field: keyof PatientRecordFormValues) =>
    errors[field]?.message ?? serverErrors[field];

  const handlePatientChange = (patientId: string) => {
    setValue('patient_id', patientId, { shouldValidate: true, shouldDirty: true });
    // Appointment belongs to the patient — clear when the patient changes.
    setValue('appointment_id', '', { shouldValidate: true, shouldDirty: true });
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      position="right"
      size="lg"
      ariaLabel="Create Patient Record"
      className="!max-w-[680px]"
    >
      <Drawer.Header>
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-h3 font-semibold tracking-tight text-neutral-900">
              Create Patient Record
            </h2>
            <p className="text-caption text-neutral-500">
              One clinical record per appointment. Records are created as drafts.
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
          <div
            role="alert"
            className="mb-4 flex flex-col gap-2 rounded-lg border border-danger/25 bg-danger/10 p-4"
          >
            <p className="text-body-sm text-danger">{serverMessage}</p>
            {conflictAppointmentId && onViewConflictRecord && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onViewConflictRecord(conflictAppointmentId)}
                leftIcon={<Icon icon={ExternalLink} size="xs" />}
              >
                View existing record
              </Button>
            )}
          </div>
        )}

        <ValidationSummary errors={errors} title="Please review the following fields:" />

        <Form grid columns={1} spacing="md" onSubmit={handleSubmit(onSubmit)}>
          {/* ── Record details ─────────────────────────────────── */}
          <fieldset className="grid grid-cols-1 gap-4 rounded-lg border border-neutral-200 p-4">
            <legend className="px-1 text-label font-semibold text-neutral-700">
              Record details
            </legend>
            <Controller
              control={control}
              name="patient_id"
              render={({ field }) => (
                <PatientPicker
                  value={field.value}
                  onChange={handlePatientChange}
                  error={fieldError('patient_id')}
                  required
                />
              )}
            />
            <Select
              label="Appointment"
              required
              placeholder={
                selectedPatientId
                  ? appointmentsLoading
                    ? 'Loading appointments…'
                    : 'Select appointment for this patient'
                  : 'Select a patient first'
              }
              disabled={!selectedPatientId || appointmentsLoading}
              options={appointmentOptions}
              error={fieldError('appointment_id')}
              {...register('appointment_id')}
            />
            {selectedPatientId &&
              appointmentsLoaded &&
              !appointmentsLoading &&
              appointmentOptions.length === 0 && (
                <p className="text-body-sm text-warning">
                  No appointments found for this patient — creating a record requires an existing
                  appointment (one record per appointment). The full appointment list has been
                  checked, not just the most recent 100.
                </p>
              )}
          </fieldset>

          {/* ── Clinical ───────────────────────────────────────── */}
          <fieldset className="grid grid-cols-1 gap-4 rounded-lg border border-neutral-200 p-4">
            <legend className="px-1 text-label font-semibold text-neutral-700">Clinical</legend>
            <Textarea
              label="Chief Complaint"
              placeholder="Primary complaint reported by the patient…"
              maxLength={PATIENT_RECORD_TEXT_MAX}
              showCharCount
              autoResize
              error={fieldError('chief_complaint')}
              {...register('chief_complaint')}
            />
            <Textarea
              label="Clinical Notes"
              placeholder="Clinical examination findings…"
              maxLength={PATIENT_RECORD_CLINICAL_NOTES_MAX}
              showCharCount
              autoResize
              error={fieldError('clinical_notes')}
              {...register('clinical_notes')}
            />
            <Textarea
              label="Doctor Remarks"
              placeholder="Doctor observations and remarks…"
              maxLength={PATIENT_RECORD_TEXT_MAX}
              showCharCount
              autoResize
              error={fieldError('doctor_remarks')}
              {...register('doctor_remarks')}
            />
            <Textarea
              label="Treatment Recommendation"
              placeholder="Recommended course of treatment…"
              maxLength={PATIENT_RECORD_TEXT_MAX}
              showCharCount
              autoResize
              error={fieldError('treatment_recommendation')}
              {...register('treatment_recommendation')}
            />
          </fieldset>

          {/* ── Medical history ───────────────────────────────── */}
          <fieldset className="grid grid-cols-1 gap-4 rounded-lg border border-neutral-200 p-4">
            <legend className="px-1 text-label font-semibold text-neutral-700">
              Medical history
            </legend>
            {(
              [
                ['systemic_diseases', 'Systemic Diseases'],
                ['surgeries', 'Surgeries'],
                ['medications', 'Medications'],
                ['habits', 'Habits'],
                ['medical_alerts', 'Medical Alerts'],
                ['allergies', 'Allergies'],
                ['dental_history', 'Dental History'],
              ] as const
            ).map(([field, label]) => (
              <Textarea
                key={field}
                label={label}
                placeholder={`${label}…`}
                maxLength={PATIENT_RECORD_TEXT_MAX}
                showCharCount
                autoResize
                error={fieldError(field)}
                {...register(field)}
              />
            ))}
          </fieldset>

          <FormActions
            onCancel={onClose}
            submitting={submitting}
            submitText="Create Record"
            cancelDisabled={submitting}
          />
        </Form>
      </Drawer.Body>
    </Drawer>
  );
};
