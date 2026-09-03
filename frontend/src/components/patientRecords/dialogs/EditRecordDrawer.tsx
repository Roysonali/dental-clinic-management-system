import { useEffect, type FC } from 'react';
import { X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Drawer } from '../../common/Drawer/Drawer';
import { IconButton } from '../../common/Button/IconButton';
import { Icon } from '../../common/Icon/Icon';
import { Alert } from '../../common/Alert/Alert';
import { Form, FormActions, ValidationSummary } from '../../common/Form';
import { Textarea } from '../../common/Input';
import { patientRecordFormSchema } from '../../../utils/patientRecordFormSchema';
import {
  PATIENT_RECORD_CLINICAL_NOTES_MAX,
  PATIENT_RECORD_TEXT_MAX,
} from '../../../constants/patientRecord';
import type { PatientRecordFormValues, PatientRecordResponse } from '../../../types/patientRecord';

interface EditRecordDrawerProps {
  open: boolean;
  onClose: () => void;
  /** The record being edited (pre-fills the form). */
  record: PatientRecordResponse;
  /** Resolved display names for the read-only record-details strip. */
  patientName: string | null;
  appointmentNumber: string | null;
  onSubmit: (values: PatientRecordFormValues) => void;
  submitting?: boolean;
  serverErrors?: Record<string, string>;
  serverMessage?: string | null;
}

/** Build pre-filled form values from the record. */
function recordToFormValues(record: PatientRecordResponse): PatientRecordFormValues {
  return {
    patient_id: record.patient_id,
    appointment_id: record.appointment_id ?? undefined,
    chief_complaint: record.chief_complaint ?? '',
    clinical_notes: record.clinical_notes ?? '',
    doctor_remarks: record.doctor_remarks ?? '',
    treatment_recommendation: record.treatment_recommendation ?? '',
    systemic_diseases: record.systemic_diseases ?? '',
    surgeries: record.surgeries ?? '',
    medications: record.medications ?? '',
    habits: record.habits ?? '',
    medical_alerts: record.medical_alerts ?? '',
    allergies: record.allergies ?? '',
    dental_history: record.dental_history ?? '',
  };
}

/**
 * EditRecordDrawer — S-04 edit-record workflow ([UI spec S-04]).
 *
 * Same sections as create, pre-filled. PATCH semantics (`exclude_unset`):
 * untouched fields are omitted; clearing a field to empty sends explicit
 * `null` to erase the stored value (a hint explains this). Patient and
 * appointment are NOT editable (immutable after creation) — shown as a
 * read-only strip. Not available on finalized records (the detail page
 * hides the Edit action; the backend 400s regardless).
 */
export const EditRecordDrawer: FC<EditRecordDrawerProps> = ({
  open,
  onClose,
  record,
  patientName,
  appointmentNumber,
  onSubmit,
  submitting = false,
  serverErrors = {},
  serverMessage = null,
}) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PatientRecordFormValues>({
    resolver: zodResolver(patientRecordFormSchema),
    mode: 'onTouched',
  });

  // Re-seed the form whenever a (new) record is opened.
  useEffect(() => {
    if (open) reset(recordToFormValues(record));
  }, [open, record, reset]);

  const fieldError = (field: keyof PatientRecordFormValues) =>
    errors[field]?.message ?? serverErrors[field];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      position="right"
      size="lg"
      ariaLabel="Edit Patient Record"
      className="!max-w-[680px]"
    >
      <Drawer.Header>
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-h3 font-semibold tracking-tight text-neutral-900">
              Edit Patient Record
            </h2>
            <p className="text-caption text-neutral-500">
              {patientName ?? `Patient #${record.patient_id.slice(0, 8)}`} ·{' '}
              {record.appointment_id
                ? (appointmentNumber ?? `Appointment #${record.appointment_id.slice(0, 8)}`)
                : 'No linked appointment'}
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
        <Alert
          variant="info"
          className="mb-4"
          title="Partial updates only"
          description="Fields you leave unchanged are kept as-is. To erase a stored value, clear the field — it will be sent as null."
        />

        {serverMessage && (
          <div role="alert" className="mb-4 rounded-lg border border-danger/25 bg-danger/10 p-4">
            <p className="text-body-sm text-danger">{serverMessage}</p>
          </div>
        )}

        <ValidationSummary errors={errors} title="Please review the following fields:" />

        <Form grid columns={1} spacing="md" onSubmit={handleSubmit(onSubmit)}>
          {/* ── Clinical ───────────────────────────────────────── */}
          <fieldset className="grid grid-cols-1 gap-4 rounded-lg border border-neutral-200 p-4">
            <legend className="px-1 text-label font-semibold text-neutral-700">Clinical</legend>
            <Textarea
              label="Chief Complaint"
              maxLength={PATIENT_RECORD_TEXT_MAX}
              showCharCount
              autoResize
              error={fieldError('chief_complaint')}
              {...register('chief_complaint')}
            />
            <Textarea
              label="Clinical Notes"
              maxLength={PATIENT_RECORD_CLINICAL_NOTES_MAX}
              showCharCount
              autoResize
              error={fieldError('clinical_notes')}
              {...register('clinical_notes')}
            />
            <Textarea
              label="Doctor Remarks"
              maxLength={PATIENT_RECORD_TEXT_MAX}
              showCharCount
              autoResize
              error={fieldError('doctor_remarks')}
              {...register('doctor_remarks')}
            />
            <Textarea
              label="Treatment Recommendation"
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
            submitText="Save Changes"
            cancelDisabled={submitting}
          />
        </Form>
      </Drawer.Body>
    </Drawer>
  );
};
