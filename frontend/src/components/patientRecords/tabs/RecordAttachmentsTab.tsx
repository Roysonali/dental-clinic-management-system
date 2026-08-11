import { useMemo, useState, type FC } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Eye, Download, Pencil, Trash2 } from 'lucide-react';
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
import { usePatientRecordNames } from '../../../hooks/patientRecords/usePatientRecordNames';
import {
  useCreateAttachment,
  useDeleteAttachment,
  useUpdateAttachment,
} from '../../../hooks/patientRecords/usePatientRecordChildMutations';
import {
  attachmentFormValuesToUpdateRequest,
  attachmentFormValuesToUploadRequest,
} from '../../../utils/patientRecordFormUtils';
import { parseApiError } from '../../../services/apiError';
import { formatISODate } from '../../../utils/date';
import { formatFileSize } from '../../../utils/patientRecordFormatting';
import {
  ATTACHMENT_TYPE_LABELS,
  ATTACHMENT_TYPE_VARIANTS,
  PREVIEWABLE_ATTACHMENT_EXTENSIONS,
} from '../../../constants/patientRecord';
import type {
  AttachmentFormValues,
  AttachmentListItem,
} from '../../../types/patientRecord';

interface RecordAttachmentsTabProps {
  recordId: string;
  isFinalized: boolean;
  notify: (variant: 'success', title: string, description?: string) => void;
}

/** Whether a stored file can be rendered inline (PDF + common images). */
function isPreviewable(row: AttachmentListItem): boolean {
  if (!row.mime_type) {
    const dot = row.file_name.lastIndexOf('.');
    const ext = dot > 0 ? row.file_name.slice(dot).toLowerCase() : '';
    return (PREVIEWABLE_ATTACHMENT_EXTENSIONS as readonly string[]).includes(ext);
  }
  const mime = row.mime_type.toLowerCase();
  return mime === 'application/pdf' || mime.startsWith('image/');
}

function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/**
 * RecordAttachmentsTab — S-13 attachments tab ([UI spec S-13]).
 *
 * REAL file uploads: Upload Attachment dialog (file picker), and per-row
 * View (browser preview for PDF/images), Download (authorized blob fetch),
 * Edit (category only) and Delete. View/Download stay available for
 * finalized records — a locked chart must still be readable; only the
 * mutating actions (Upload/Edit/Delete) hide once finalized.
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

  const items = useMemo(() => listQuery.data?.items ?? [], [listQuery.data]);
  const totalPages = Math.max(1, listQuery.data?.pages ?? 1);
  const errorMessage = listQuery.error ? parseApiError(listQuery.error).message : null;

  // Resolve "Uploaded by" names (best-effort; "User #id" fallback).
  const uploaderIds = useMemo(
    () => Array.from(new Set(items.map((item) => item.uploaded_by).filter((id): id is number => id !== null))),
    [items],
  );
  const names = usePatientRecordNames([], [], uploaderIds);

  const createMutation = useCreateAttachment(recordId);
  const updateMutation = useUpdateAttachment(recordId);
  const deleteMutation = useDeleteAttachment(recordId);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AttachmentListItem | null>(null);
  const [deleting, setDeleting] = useState<AttachmentListItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
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
      createMutation.mutate(attachmentFormValuesToUploadRequest(values), {
        onSuccess: () => {
          setFormOpen(false);
          notify('success', 'Attachment uploaded');
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

  const handleView = async (row: AttachmentListItem) => {
    if (!isPreviewable(row)) {
      setServerMessage('Preview is not supported for this file type — use Download instead.');
      return;
    }
    setBusyId(row.id);
    setServerMessage(null);
    try {
      const blob = await patientRecordService.previewAttachment(row.id);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      // Revoke once the new tab has had a chance to load the blob URL.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      setServerMessage(parseApiError(error).message);
    } finally {
      setBusyId(null);
    }
  };

  const handleDownload = async (row: AttachmentListItem) => {
    setBusyId(row.id);
    setServerMessage(null);
    try {
      const blob = await patientRecordService.downloadAttachment(row.id);
      triggerBlobDownload(blob, row.file_name);
    } catch (error) {
      setServerMessage(parseApiError(error).message);
    } finally {
      setBusyId(null);
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
      header: 'File',
      render: (row) => (
        <span className="block max-w-[240px] truncate font-medium text-neutral-900" title={row.file_name}>
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
      key: 'uploaded_by',
      header: 'Uploaded by',
      render: (row) => {
        const name = row.uploaded_by != null ? names.userNames.get(row.uploaded_by) : null;
        return (
          <span className="text-neutral-600">
            {row.uploaded_by != null ? (name ?? `User #${row.uploaded_by}`) : '—'}
          </span>
        );
      },
    },
    {
      key: 'created_at',
      header: 'Uploaded',
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
              Upload Attachment
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
          emptyTitle="No attachments"
          emptyDescription="Upload clinical files (X-rays, scans, reports, documents) for this record."
          emptyAction={
            !isFinalized ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setServerErrors({});
                  setServerMessage(null);
                  setFormOpen(true);
                }}
                leftIcon={<Icon icon={Plus} size="xs" />}
              >
                Upload Attachment
              </Button>
            ) : undefined
          }
          rowActionsHeader=""
          rowActions={(row) => (
            <div className="flex items-center justify-end gap-1">
              {isPreviewable(row) ? (
                <IconButton
                  icon={<Icon icon={Eye} size="sm" />}
                  aria-label={`Preview ${row.file_name}`}
                  title="Preview in browser"
                  variant="ghost"
                  size="sm"
                  loading={busyId === row.id}
                  onClick={() => void handleView(row)}
                />
              ) : (
                <span
                  title="Preview not supported for this file type"
                  className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-caption text-neutral-400"
                >
                  Preview N/A
                </span>
              )}
              <IconButton
                icon={<Icon icon={Download} size="sm" />}
                aria-label={`Download ${row.file_name}`}
                title="Download file"
                variant="ghost"
                size="sm"
                loading={busyId === row.id}
                onClick={() => void handleDownload(row)}
              />
              {!isFinalized && (
                <>
                  <IconButton
                    icon={<Icon icon={Pencil} size="sm" />}
                    aria-label={`Edit attachment ${row.file_name}`}
                    title="Edit attachment category"
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
                    title="Delete attachment"
                    variant="ghost"
                    size="sm"
                    className="text-danger hover:bg-danger/10"
                    onClick={() => {
                      setServerMessage(null);
                      setDeleting(row);
                    }}
                  />
                </>
              )}
            </div>
          )}
        />

        {serverMessage && (
          <p role="alert" className="mt-3 text-body-sm text-danger">
            {serverMessage}
          </p>
        )}

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
