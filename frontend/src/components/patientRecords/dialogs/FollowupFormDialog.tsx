import { useEffect, type FC } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '../../common/Modal/Modal';
import { Button } from '../../common/Button/Button';
import { Form, ValidationSummary } from '../../common/Form';
import { DatePicker } from '../../common/Input/DatePicker';
import { Textarea } from '../../common/Input/Textarea';
import {
  defaultFollowupFormValues,
  followupFormSchema,
} from '../../../utils/patientRecordFormSchema';
import { FOLLOWUP_NOTES_MAX } from '../../../constants/patientRecord';
import { todayLocalISO } from '../../../utils/date';
import type { FollowupFormValues, FollowupListItem } from '../../../types/patientRecord';

interface FollowupFormDialogProps {
  open: boolean;
  /** Null → create mode; set → edit mode. */
  followup: FollowupListItem | null;
  submitting?: boolean;
  serverErrors?: Record<string, string>;
  serverMessage?: string | null;
  onSubmit: (values: FollowupFormValues) => void;
  onClose: () => void;
}

/**
 * FollowupFormDialog — schedule/edit a follow-up ([UI spec S-12]).
 *
 * `followup_date` must be today or future — enforced by the zod schema
 * (min = today in the DatePicker) and re-validated server-side (a past date
 * is a 400 business rule, rendered inline via `serverMessage`). Notes ≤ 2000.
 */
export const FollowupFormDialog: FC<FollowupFormDialogProps> = ({
  open,
  followup,
  submitting = false,
  serverErrors = {},
  serverMessage = null,
  onSubmit,
  onClose,
}) => {
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FollowupFormValues>({
    resolver: zodResolver(followupFormSchema),
    mode: 'onTouched',
    defaultValues: defaultFollowupFormValues,
  });

  useEffect(() => {
    if (open) {
      reset(
        followup
          ? { followup_date: followup.followup_date, notes: followup.notes ?? '' }
          : defaultFollowupFormValues,
      );
    }
  }, [open, followup, reset]);

  const fieldError = (field: keyof FollowupFormValues) =>
    errors[field]?.message ?? serverErrors[field];

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      ariaLabel={followup ? 'Edit follow-up' : 'Schedule follow-up'}
    >
      <Modal.Header>
        <h2 className="text-h4 font-semibold tracking-tight text-neutral-900">
          {followup ? 'Edit Follow-up' : 'Schedule Follow-up'}
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
          <Controller
            control={control}
            name="followup_date"
            render={({ field }) => (
              <DatePicker
                label="Follow-up Date"
                required
                minDate={todayLocalISO()}
                helperText="Must be today or a future date."
                error={fieldError('followup_date')}
                value={field.value || undefined}
                onChange={field.onChange}
              />
            )}
          />
          <Textarea
            label="Notes"
            maxLength={FOLLOWUP_NOTES_MAX}
            showCharCount
            autoResize
            placeholder="Follow-up instructions or clinical notes…"
            error={fieldError('notes')}
            {...register('notes')}
          />
        </Form>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button variant="primary" loading={submitting} onClick={handleSubmit(onSubmit)}>
          {followup ? 'Save Changes' : 'Schedule Follow-up'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
