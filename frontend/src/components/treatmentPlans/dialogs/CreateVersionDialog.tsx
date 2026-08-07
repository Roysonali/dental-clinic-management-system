import type { FC } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '../../common/Modal/Modal';
import { Form, FormActions, ValidationSummary } from '../../common/Form';
import { Textarea } from '../../common/Input';
import {
  versionFormSchema,
  defaultVersionFormValues,
  type VersionFormValues,
} from '../../../utils/versionFormSchema';

interface CreateVersionDialogProps {
  open: boolean;
  onSubmit: (changeReason: string) => void;
  submitting?: boolean;
  error?: string | null;
  onClose: () => void;
}

/**
 * CreateVersionDialog — S-05 snapshot creation
 * (POST /treatment-plans/{id}/versions, `change_reason` 1–500, trimmed).
 * Snapshots are immutable — restoring is a separate confirm ([MAP §8]).
 */
export const CreateVersionDialog: FC<CreateVersionDialogProps> = ({
  open,
  onSubmit,
  submitting = false,
  error = null,
  onClose,
}) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VersionFormValues>({
    resolver: zodResolver(versionFormSchema),
    mode: 'onTouched',
    defaultValues: defaultVersionFormValues,
  });

  return (
    <Modal open={open} onClose={onClose} size="sm" ariaLabel="Create version">
      <Modal.Header>
        <h2 className="text-h4 font-semibold text-neutral-900">Create Version Snapshot</h2>
      </Modal.Header>
      <Modal.Body>
        <p className="mb-4 text-body-sm text-neutral-500">
          A version captures the current plan items as an immutable snapshot.
        </p>
        {error && (
          <div role="alert" className="mb-4 rounded-lg border border-danger/25 bg-danger/10 p-4">
            <p className="text-body-sm text-danger">{error}</p>
          </div>
        )}
        <ValidationSummary errors={errors} title="Please review the following fields:" />
        <Form onSubmit={handleSubmit((values) => onSubmit(values.change_reason))}>
          <Textarea
            label="Change Reason"
            required
            placeholder="Why is this version being created?"
            maxLength={500}
            rows={3}
            error={errors.change_reason?.message}
            {...register('change_reason')}
          />
          <FormActions
            onCancel={onClose}
            submitting={submitting}
            submitText="Create Version"
            className="mt-4"
          />
        </Form>
      </Modal.Body>
    </Modal>
  );
};
