import { useEffect, type FC } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Lock } from 'lucide-react';
import { Modal } from '../../common/Modal/Modal';
import { Button } from '../../common/Button/Button';
import { Icon } from '../../common/Icon/Icon';
import { Form, ValidationSummary } from '../../common/Form';
import { Select } from '../../common/Input';
import { FileUpload } from '../../common/Input/FileUpload';
import {
  attachmentEditFormSchema,
  attachmentFormSchema,
  defaultAttachmentFormValues,
} from '../../../utils/patientRecordFormSchema';
import { ATTACHMENT_TYPE_OPTIONS } from '../../../constants/patientRecord';
import {
  ATTACHMENT_FILE_ACCEPT,
  ATTACHMENT_FILE_ACCEPT_HINT,
  ATTACHMENT_MAX_FILE_SIZE_MB,
} from '../../../constants/patientRecord';
import { formatFileSize } from '../../../utils/patientRecordFormatting';
import type {
  AttachmentFormValues,
  AttachmentListItem,
} from '../../../types/patientRecord';

interface AttachmentFormDialogProps {
  open: boolean;
  /** Null → create mode; set → edit mode (file immutable). */
  attachment: AttachmentListItem | null;
  submitting?: boolean;
  serverErrors?: Record<string, string>;
  serverMessage?: string | null;
  onSubmit: (values: AttachmentFormValues) => void;
  onClose: () => void;
}

function attachmentToFormValues(attachment: AttachmentListItem): AttachmentFormValues {
  return {
    attachment_type: attachment.attachment_type,
    file: null,
  };
}

/**
 * AttachmentFormDialog — upload a REAL file ([UI spec S-13]).
 *
 * Create mode: the user picks a file (drag & drop / browse — shared
 * FileUpload component) and a category; client-side guard rails validate
 * size and type before the multipart POST. Edit mode: only the category
 * is editable — the stored file is immutable on the backend, so the file
 * picker is replaced by a read-only file summary.
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

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<AttachmentFormValues>({
    resolver: zodResolver(isEdit ? attachmentEditFormSchema : attachmentFormSchema),
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
      ariaLabel={isEdit ? 'Edit attachment' : 'Upload attachment'}
    >
      <Modal.Header>
        <h2 className="text-h4 font-semibold tracking-tight text-neutral-900">
          {isEdit ? 'Edit Attachment' : 'Upload Attachment'}
        </h2>
      </Modal.Header>

      <Modal.Body>
        {!isEdit && (
          <p className="mb-4 text-caption text-neutral-500">
            Choose a clinical file to attach to this record — X-rays, scans,
            lab reports or documents. The file is uploaded to the clinic&apos;s
            secure storage; only metadata is listed here.
          </p>
        )}
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

          {isEdit ? (
            /* Read-only file summary — the stored file cannot be replaced. */
            <div>
              <span className="mb-1 block text-label font-medium text-neutral-700">File</span>
              <div className="flex items-center gap-2.5 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5">
                <Icon icon={Lock} size="sm" className="shrink-0 text-neutral-400" />
                <div className="min-w-0">
                  <p className="truncate text-body text-neutral-800">{attachment.file_name}</p>
                  <p className="text-caption text-neutral-400">
                    {attachment.mime_type || 'Unknown type'} · {formatFileSize(attachment.file_size)}
                  </p>
                </div>
              </div>
              <p className="mt-1 text-caption text-neutral-500">
                The file itself cannot be changed after upload — only its category.
              </p>
            </div>
          ) : (
            <Controller
              name="file"
              control={control}
              render={({ field }) => (
                <FileUpload
                  label="File"
                  required
                  accept={ATTACHMENT_FILE_ACCEPT}
                  maxSizeMB={ATTACHMENT_MAX_FILE_SIZE_MB}
                  value={field.value ? [field.value] : []}
                  onChange={(files) => field.onChange(files[0] ?? null)}
                  dropLabel="Choose a file — drag & drop or click to browse"
                  dropHint={`${ATTACHMENT_FILE_ACCEPT_HINT} • Max ${ATTACHMENT_MAX_FILE_SIZE_MB} MB`}
                  error={fieldError('file')}
                />
              )}
            />
          )}
        </Form>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button variant="primary" loading={submitting} onClick={handleSubmit(onSubmit)}>
          {isEdit ? 'Save Changes' : 'Upload Attachment'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
