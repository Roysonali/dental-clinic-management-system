import { useState, type FC } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Card } from '../../common/Card/Card';
import { Button } from '../../common/Button/Button';
import { Icon } from '../../common/Icon/Icon';
import { IconButton } from '../../common/Button/IconButton';
import { Badge } from '../../common/Badge';
import { DataTable, type DataTableColumn } from '../../common/DataTable';
import { Pagination } from '../../common/Pagination/Pagination';
import { AttachmentFormDialog } from '../dialogs/AttachmentFormDialog';
import { AttachmentDeleteConfirm } from '../dialogs/AttachmentDeleteConfirm';
import { patientRecordService } from '../../../services/patientRecordService';
import { patientRecordQueryKeys } from '../../../hooks/patientRecords/patientRecordQueryKeys';
import {
  useCreateAttachment,
  useDeleteAttachment,
  useUpdateAttachment,
} from '../../../hooks/patientRecords/usePatientRecordChildMutations';
import {
  attachmentFormValuesToCreateRequest,
  attachmentFormValuesToUpdateRequest,
} from '../../../utils/patientRecordFormUtils';
import { parseApiError } from '../../../services/apiError';
import { formatISODate } from '../../../utils/date';
import { formatFileSize } from '../../../utils/patientRecordFormatting';
import { ATTACHMENT_TYPE_LABELS, ATTACHMENT_TYPE_VARIANTS } from '../../../constants/patientRecord';
import type {
  AttachmentFormValues,
  AttachmentListItem,
} from '../../../types/patientRecord';

interface RecordAttachmentsTabProps {
  recordId: string;
  isFinalized: boolean;
  notify: (variant: 'success', title: string, description?: string) => void;
}

/**
 * RecordAttachmentsTab — S-13 attachments tab ([UI spec S-13]).
 *
 * Metadata ONLY — no upload/drag-drop/download/preview (BCR O5). Columns:
 * type badge · file name · size (human-readable) · MIME · registered. Edit
 * keeps `file_path` read-only (immutable on the backend). All actions
 * hidden once the record is finalized.
 */
export const RecordAttachmentsTab: FC<RecordAttachmentsTabProps> = ({
  recordId,
  isFinalized,
  notify,
}) => {
  const [page, setPage] = useState(1);

  const listQuery = useQuery({
    queryKey: patientRecordQueryKeys.attachments(recordId, { page, page_size: 10 }),
    queryFn: () => patientRecordService.listAttachments(recordId, { page, page_size: 10 }),
    enabled: recordId.length > 0,
  });

  const items = listQuery.data?.items ?? [];
  const totalPages = Math.max(1, listQuery.data?.pages ?? 1);
  const errorMessage = listQuery.error ? parseApiError(listQuery.error).message : null;

  const createMutation = useCreateAttachment(recordId);
  const updateMutation = useUpdateAttachment(recordId);
  const deleteMutation = useDeleteAttachment(recordId);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AttachmentListItem | null>(null);
  const [deleting, setDeleting] = useState<AttachmentListItem | null>(null);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [serverMessage, setServerMessage] = useState<string | null>(null);

  const handleSubmit = (values: AttachmentFormValues) => {
    setServerErrors({});
    setServerMessage(null);
    if (editing) {
      updateMutation.mutate(
        {
          id: editing.id,
          payload: attachmentFormValuesToUpdateRequest(values, {
            file_name: editing.file_name,
            mime_type: editing.mime_type,
            file_size: editing.file_size,
            attachment_type: editing.attachment_type,
          }),
        },
        {
          onSuccess: () => {
            setFormOpen(false);
            notify('success', 'Attachment updated');
          },
          onError: (error) => handleError(error),
        },
      );
    } else {
      createMutation.mutate(attachmentFormValuesToCreateRequest(values), {
        onSuccess: () => {
          setFormOpen(false);
          notify('success', 'Attachment registered');
        },
        onError: (error) => handleError(error),
      });
    }
  };

  const handleError = (error: Error) => {
    const info = parseApiError(error);
    if (info.kind === 'validation' && Object.keys(info.fieldErrors).length > 0) {
      setServerErrors(info.fieldErrors);
    } else {
      setServerMessage(info.message);
    }
  };

  const handleDelete = () => {
    if (!deleting) return;
    deleteMutation.mutate(deleting.id, {
      onSuccess: () => {
        setDeleting(null);
        notify('success', 'Attachment removed');
      },
      onError: (error) => setServerMessage(parseApiError(error).message),
    });
  };

  const columns: DataTableColumn<AttachmentListItem>[] = [
    {
      key: 'attachment_type',
      header: 'Type',
      render: (row) => (
        <Badge variant={ATTACHMENT_TYPE_VARIANTS[row.attachment_type]} size="sm">
          {ATTACHMENT_TYPE_LABELS[row.attachment_type]}
        </Badge>
      ),
    },
    {
      key: 'file_name',
      header: 'File Name',
      render: (row) => (
        <span className="block max-w-[260px] truncate font-medium text-neutral-900" title={row.file_name}>
          {row.file_name}
        </span>
      ),
    },
    {
      key: 'file_size',
      header: 'Size',
      render: (row) => <span className="text-neutral-600">{formatFileSize(row.file_size)}</span>,
    },
    {
      key: 'mime_type',
      header: 'MIME',
      render: (row) => (
        <span className="font-mono text-caption text-neutral-500">{row.mime_type || '—'}</span>
      ),
    },
    {
      key: 'created_at',
      header: 'Registered',
      render: (row) => <span className="text-neutral-600">{formatISODate(row.created_at)}</span>,
    },
  ];

  return (
    <Card>
      <Card.Header
        title="Attachments"
        actions={
          !isFinalized ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setServerErrors({});
                setServerMessage(null);
                setEditing(null);
                setFormOpen(true);
              }}
              leftIcon={<Icon icon={Plus} size="xs" />}
            >
              Register Attachment
            </Button>
          ) : undefined
        }
      />
      <Card.Body>
        <DataTable
          columns={columns}
          data={items}
          rowKey={(row) => row.id}
          loading={listQuery.isLoading}
          error={errorMessage}
          onRetry={() => void listQuery.refetch()}
          ariaLabel="Attachments"
          emptyTitle="No attachments registered"
          emptyDescription="Register file metadata (type, name, path) for this record."
          emptyAction={
            !isFinalized ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setFormOpen(true)}
                leftIcon={<Icon icon={Plus} size="xs" />}
              >
                Register Attachment
              </Button>
            ) : undefined
          }
          rowActionsHeader=""
          rowActions={(row) =>
            !isFinalized ? (
              <div className="flex items-center justify-end gap-1">
                <IconButton
                  icon={<Icon icon={Pencil} size="sm" />}
                  aria-label={`Edit attachment ${row.file_name}`}
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setServerErrors({});
                    setServerMessage(null);
                    setEditing(row);
                    setFormOpen(true);
                  }}
                />
                <IconButton
                  icon={<Icon icon={Trash2} size="sm" />}
                  aria-label={`Delete attachment ${row.file_name}`}
                  variant="ghost"
                  size="sm"
                  className="text-danger hover:bg-danger/10"
                  onClick={() => {
                    setServerMessage(null);
                    setDeleting(row);
                  }}
                />
              </div>
            ) : undefined
          }
        />

        {!listQuery.isLoading && items.length > 0 && (
          <div className="mt-4">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              totalCount={listQuery.data?.total}
              pageSize={10}
            />
          </div>
        )}
      </Card.Body>

      <AttachmentFormDialog
        open={formOpen}
        attachment={editing}
        submitting={createMutation.isPending || updateMutation.isPending}
        serverErrors={serverErrors}
        serverMessage={serverMessage}
        onSubmit={handleSubmit}
        onClose={() => setFormOpen(false)}
      />

      <AttachmentDeleteConfirm
        open={deleting !== null}
        fileName={deleting?.file_name ?? null}
        submitting={deleteMutation.isPending}
        error={serverMessage}
        onConfirm={handleDelete}
        onClose={() => {
          setDeleting(null);
          setServerMessage(null);
        }}
      />
    </Card>
  );
};
