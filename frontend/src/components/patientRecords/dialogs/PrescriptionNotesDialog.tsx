import { useEffect, type FC } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '../../common/Modal/Modal';
import { Button } from '../../common/Button/Button';
import { Form } from '../../common/Form';
import { Textarea } from '../../common/Input/Textarea';
import { Spinner } from '../../common/Spinner/Spinner';
import { z } from 'zod';
import { patientRecordService } from '../../../services/patientRecordService';
import { patientRecordQueryKeys } from '../../../hooks/patientRecords/patientRecordQueryKeys';
import { PRESCRIPTION_NOTES_MAX } from '../../../constants/patientRecord';

interface PrescriptionNotesDialogProps {
  open: boolean;
  /** The prescription whose notes are being edited. */
  prescriptionId: string | null;
  submitting?: boolean;
  error?: string | null;
  onSubmit: (notes: string) => void;
  onClose: () => void;
}

/** Notes-only schema (PATCH /prescriptions/{id} accepts ONLY notes). */
const notesSchema = z.object({
  notes: z
    .string()
    .trim()
    .refine((v) => v.length === 0 || v.length <= PRESCRIPTION_NOTES_MAX, {
      message: `Notes must be at most ${PRESCRIPTION_NOTES_MAX} characters`,
    }),
});

type NotesFormValues = z.infer<typeof notesSchema>;

/**
 * PrescriptionNotesDialog — edit prescription notes only ([UI spec S-09]).
 *
 * The backend's `PrescriptionUpdate` accepts ONLY `notes` — items are
 * managed inside the prescription view. The list payload has no notes, so
 * the dialog fetches the prescription detail (GET /prescriptions/{id}) to
 * pre-fill them.
 */
export const PrescriptionNotesDialog: FC<PrescriptionNotesDialogProps> = ({
  open,
  prescriptionId,
  submitting = false,
  error = null,
  onSubmit,
  onClose,
}) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<NotesFormValues>({
    resolver: zodResolver(notesSchema),
    mode: 'onTouched',
    defaultValues: { notes: '' },
  });

  const prescriptionQuery = useQuery({
    queryKey: patientRecordQueryKeys.prescription(prescriptionId ?? ''),
    queryFn: () => patientRecordService.getPrescription(prescriptionId as string),
    enabled: open && prescriptionId != null,
  });

  // Re-seed the form whenever the fetched prescription changes.
  useEffect(() => {
    if (open && prescriptionQuery.data) {
      reset({ notes: prescriptionQuery.data.notes ?? '' });
    }
  }, [open, prescriptionQuery.data, reset]);

  const loading = open && prescriptionQuery.isPending;

  return (
    <Modal open={open} onClose={onClose} size="md" ariaLabel="Edit prescription notes">
      <Modal.Header>
        <h2 className="text-h4 font-semibold tracking-tight text-neutral-900">
          Edit Prescription Notes
        </h2>
      </Modal.Header>
      <Modal.Body>
        <p className="mb-4 text-caption text-neutral-500">
          Only the notes can be edited here — medicines are managed inside the
          prescription view.
        </p>
        {loading ? (
          <div className="flex items-center gap-2 text-caption text-neutral-400" role="status">
            <Spinner size="sm" variant="neutral" /> Loading notes…
          </div>
        ) : (
          <Form grid columns={1} onSubmit={handleSubmit((values) => onSubmit(values.notes))}>
            <Textarea
              label="Notes"
              maxLength={PRESCRIPTION_NOTES_MAX}
              showCharCount
              autoResize
              placeholder="General prescription notes…"
              error={errors.notes?.message}
              {...register('notes')}
            />
          </Form>
        )}
        {error && (
          <p role="alert" className="mt-3 text-body-sm text-danger">
            {error}
          </p>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={submitting || loading}>
          Cancel
        </Button>
        <Button
          variant="primary"
          loading={submitting}
          disabled={loading}
          onClick={handleSubmit((values) => onSubmit(values.notes))}
        >
          Save Notes
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
