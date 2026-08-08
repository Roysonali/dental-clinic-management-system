import { useEffect, type FC } from 'react';
import { Lock } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '../../common/Modal/Modal';
import { Button } from '../../common/Button/Button';
import { Icon } from '../../common/Icon/Icon';
import { Form, ValidationSummary } from '../../common/Form';
import { Input, Select } from '../../common/Input';
import {
  attachmentFormSchema,
  defaultAttachmentFormValues,
} from '../../../utils/patientRecordFormSchema';
import { ATTACHMENT_TYPE_OPTIONS } from '../../../constants/patientRecord';
import { patientRecordService } from '../../../services/patientRecordService';
import { patientRecordQueryKeys } from '../../../hooks/patientRecords/patientRecordQueryKeys';
import { Spinner } from '../../common/Spinner/Spinner';
import type {
  AttachmentFormValues,
  AttachmentListItem,
} from '../../../types/patientRecord';

interface AttachmentFormDialogProps {
  open: boolean;
  /** Null → create mode; set → edit mode (file_path immutable). */
  attachment: AttachmentListItem | null;
  submitting?: boolean;
  serverErrors?: Record<string, string>;
  serverMessage?: string | null;
  onSubmit: (values: AttachmentFormValues) => void;
  onClose: () => void;
}

function attachmentToFormValues(
  attachment: AttachmentListItem & { file_path?: string },
): AttachmentFormValues {
  return {
    attachment_type: attachment.attachment_type,
    file_name: attachment.file_name,
    // Carried so the shared schema validates; never sent in the update payload
    // (file_path is immutable on the backend).
    file_path: attachment.file_path ?? '',
    mime_type: attachment.mime_type ?? '',
    file_size: attachment.file_size != null ? String(attachment.file_size) : '',
  };
}

/**
 * AttachmentFormDialog — register/edit attachment METADATA ([UI spec S-13]).
 *
 * There is no file upload/download/preview anywhere in the backend (BCR O5):
 * the user types a file_name and a client-supplied file_path string (e.g. a
 * UNC path or URL). In edit mode `file_path` is immutable (not in the update
 * allowlist) — rendered read-only with a lock hint.
 */
export const AttachmentFormDialog: FC<AttachmentFormDialogProps> = ({
  open,
  attachment,
  submitting = false,
  serverErrors = {},
  serverMessage = null,
  onSubmit,
  onClose,
}) => {
  const isEdit = attachment !== null;

  // The list payload has no file_path (immutable field) — fetch the full
  // attachment when editing so the read-only path strip shows the real value.
  const detailQuery = useQuery({
    queryKey: patientRecordQueryKeys.attachment(attachment?.id ?? ''),
    queryFn: () => patientRecordService.getAttachment(attachment?.id as string),
    enabled: open && isEdit,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AttachmentFormValues>({
    resolver: zodResolver(attachmentFormSchema),
    mode: 'onTouched',
    defaultValues: defaultAttachmentFormValues,
  });

  useEffect(() => {
    if (open) {
      const prefill = attachment ? attachmentToFormValues(attachment) : defaultAttachmentFormValues;
      reset(prefill);
    }
  }, [open, attachment, reset]);

  const fieldError = (field: keyof AttachmentFormValues) =>
    errors[field]?.message ?? serverErrors[field];

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      ariaLabel={isEdit ? 'Edit attachment' : 'Register attachment'}
    >
      <Modal.Header>
        <h2 className="text-h4 font-semibold tracking-tight text-neutral-900">
          {isEdit ? 'Edit Attachment' : 'Register Attachment'}
        </h2>
      </Modal.Header>

      <Modal.Body>
        <p className="mb-4 text-caption text-neutral-500">
          Attachments are metadata only — no file is uploaded. Enter the path
          or link where the file lives on the clinic&apos;s storage.
        </p>
        {serverMessage && (
          <div role="alert" className="mb-4 rounded-lg border border-danger/25 bg-danger/10 p-4">
            <p className="text-body-sm text-danger">{serverMessage}</p>
          </div>
        )}
        <ValidationSummary errors={errors} title="Please review the following fields:" />

        <Form grid columns={1} spacing="md" onSubmit={handleSubmit(onSubmit)}>
          <Select
            label="Attachment Type"
            required
            placeholder="Select type"
            options={ATTACHMENT_TYPE_OPTIONS}
            error={fieldError('attachment_type')}
            {...register('attachment_type')}
          />
          <Input
            label="File Name"
            required
            maxLength={255}
            placeholder="e.g. opg_scan.jpg"
            error={fieldError('file_name')}
            {...register('file_name')}
          />
          {isEdit ? (
            <div>
              <span className="mb-1 block text-label font-medium text-neutral-700">File Path</span>
              {detailQuery.isPending ? (
                <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-caption text-neutral-400">
                  <Spinner size="sm" variant="neutral" /> Loading…
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-body text-neutral-400">
                  <Icon icon={Lock} size="sm" />
                  <span className="truncate">{detailQuery.data?.file_path ?? '—'}</span>
                </div>
              )}
              <p className="mt-1 text-caption text-neutral-500">
                The file path cannot be changed after registration.
              </p>
            </div>
          ) : (
            <Input
              label="File Path"
              required
              maxLength={1000}
              placeholder="e.g. D:\\Xrays\\PAT-0001\\img01.png"
              helperText="Path or link on the clinic's storage — text only, no upload."
              error={fieldError('file_path')}
              {...register('file_path')}
            />
          )}
          <Input
            label="MIME Type"
            maxLength={100}
            placeholder="e.g. image/jpeg"
            error={fieldError('mime_type')}
            {...register('mime_type')}
          />
          <Input
            label="File Size (bytes)"
            inputMode="numeric"
            placeholder="e.g. 524288"
            helperText="Optional; maximum 50 MB."
            error={fieldError('file_size')}
            {...register('file_size')}
          />
        </Form>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button variant="primary" loading={submitting} onClick={handleSubmit(onSubmit)}>
          {isEdit ? 'Save Changes' : 'Register Attachment'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
