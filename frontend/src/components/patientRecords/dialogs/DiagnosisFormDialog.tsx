import { useEffect, type FC } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '../../common/Modal/Modal';
import { Button } from '../../common/Button/Button';
import { Form, ValidationSummary } from '../../common/Form';
import { Input } from '../../common/Input/Input';
import { Select } from '../../common/Input/Select';
import { Textarea } from '../../common/Input/Textarea';
import {
  defaultDiagnosisFormValues,
  diagnosisFormSchema,
} from '../../../utils/patientRecordFormSchema';
import { DIAGNOSIS_NOTES_MAX, DIAGNOSIS_NAME_MAX } from '../../../constants/patientRecord';
import type { DiagnosisFormValues, DiagnosisListItem } from '../../../types/patientRecord';

/**
 * Edit target: the list row plus the `notes` field (returned only by
 * GET /diagnoses/{id}, which the tab fetches before opening the dialog — L-4).
 */
export type DiagnosisEditTarget = DiagnosisListItem & { notes: string | null };

interface DiagnosisFormDialogProps {
  open: boolean;
  /** Null → create mode; set → edit mode (pre-filled, incl. stored notes). */
  diagnosis: DiagnosisEditTarget | null;
  /** True while the detail fetch that supplies `notes` is in flight. */
  loading?: boolean;
  submitting?: boolean;
  serverErrors?: Record<string, string>;
  serverMessage?: string | null;
  onSubmit: (values: DiagnosisFormValues) => void;
  onClose: () => void;
}

/** Pre-fill edit values from an existing diagnosis (notes shown/editable/clearable). */
function diagnosisToFormValues(diagnosis: DiagnosisEditTarget): DiagnosisFormValues {
  return {
    diagnosis_name: diagnosis.diagnosis_name,
    diagnosis_type: diagnosis.diagnosis_type,
    notes: diagnosis.notes ?? '',
  };
}

/**
 * DiagnosisFormDialog — create/edit diagnosis ([UI spec S-08]).
 *
 * Fields: diagnosis_name (2–255 required), diagnosis_type (PROVISIONAL |
 * CONFIRMED required), notes (≤ 2000 optional). The list endpoint omits
 * `notes`, so edit mode fetches GET /diagnoses/{id} first (L-4) and the
 * stored notes are visible, editable and clearable — clearing sends an
 * explicit `null` to erase them server-side.
 */
export const DiagnosisFormDialog: FC<DiagnosisFormDialogProps> = ({
  open,
  diagnosis,
  loading = false,
  submitting = false,
  serverErrors = {},
  serverMessage = null,
  onSubmit,
  onClose,
}) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DiagnosisFormValues>({
    resolver: zodResolver(diagnosisFormSchema),
    mode: 'onTouched',
    defaultValues: defaultDiagnosisFormValues,
  });

  useEffect(() => {
    if (open) reset(diagnosis ? diagnosisToFormValues(diagnosis) : defaultDiagnosisFormValues);
  }, [open, diagnosis, reset]);

  const fieldError = (field: keyof DiagnosisFormValues) =>
    errors[field]?.message ?? serverErrors[field];

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      ariaLabel={diagnosis ? 'Edit diagnosis' : 'Add diagnosis'}
    >
      <Modal.Header>
        <h2 className="text-h4 font-semibold tracking-tight text-neutral-900">
          {diagnosis ? 'Edit Diagnosis' : 'Add Diagnosis'}
        </h2>
      </Modal.Header>

      <Modal.Body>
        {serverMessage && (
          <div role="alert" className="mb-4 rounded-lg border border-danger/25 bg-danger/10 p-4">
            <p className="text-body-sm text-danger">{serverMessage}</p>
          </div>
        )}
        <ValidationSummary errors={errors} title="Please review the following fields:" />

        <Form grid columns={1} spacing="md" onSubmit={handleSubmit(onSubmit)}>
          <Input
            label="Diagnosis Name"
            required
            maxLength={DIAGNOSIS_NAME_MAX}
            placeholder="e.g. Dental Caries"
            error={fieldError('diagnosis_name')}
            {...register('diagnosis_name')}
          />
          <Select
            label="Diagnosis Type"
            required
            placeholder="Select type"
            options={[
              { value: 'PROVISIONAL', label: 'Provisional' },
              { value: 'CONFIRMED', label: 'Confirmed' },
            ]}
            error={fieldError('diagnosis_type')}
            {...register('diagnosis_type')}
          />
          <Textarea
            label="Notes"
            maxLength={DIAGNOSIS_NOTES_MAX}
            showCharCount
            autoResize
            placeholder="Additional clinical observations…"
            error={fieldError('notes')}
            {...register('notes')}
          />
        </Form>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={submitting || loading}>
          Cancel
        </Button>
        <Button
          variant="primary"
          loading={submitting}
          disabled={loading}
          onClick={handleSubmit(onSubmit)}
        >
          {diagnosis ? 'Save Changes' : 'Add Diagnosis'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
