import { useState, type FC } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Card } from '../../common/Card/Card';
import { Button } from '../../common/Button/Button';
import { Icon } from '../../common/Icon/Icon';
import { IconButton } from '../../common/Button/IconButton';
import { DataTable, type DataTableColumn } from '../../common/DataTable';
import { Pagination } from '../../common/Pagination/Pagination';
import { FollowupFormDialog } from '../dialogs/FollowupFormDialog';
import { FollowupDeleteConfirm } from '../dialogs/FollowupDeleteConfirm';
import { patientRecordService } from '../../../services/patientRecordService';
import { patientRecordQueryKeys } from '../../../hooks/patientRecords/patientRecordQueryKeys';
import {
  useCreateFollowup,
  useDeleteFollowup,
  useUpdateFollowup,
} from '../../../hooks/patientRecords/usePatientRecordChildMutations';
import {
  followupFormValuesToCreateRequest,
  followupFormValuesToUpdateRequest,
} from '../../../utils/patientRecordFormUtils';
import { parseApiError } from '../../../services/apiError';
import { formatISODate } from '../../../utils/date';
import type { FollowupFormValues, FollowupListItem } from '../../../types/patientRecord';

interface RecordFollowupsTabProps {
  recordId: string;
  isFinalized: boolean;
  notify: (variant: 'success', title: string, description?: string) => void;
}

/**
 * RecordFollowupsTab — S-12 follow-ups tab ([UI spec S-12]).
 *
 * Ordered soonest-first (`followup_date ASC` — the backend's fixed order).
 * Schedule/Edit enforce the today-or-future rule (client schema + server
 * 400 rendered inline). Delete hidden once the record is finalized.
 */
export const RecordFollowupsTab: FC<RecordFollowupsTabProps> = ({
  recordId,
  isFinalized,
  notify,
}) => {
  const [page, setPage] = useState(1);

  const listQuery = useQuery({
    queryKey: patientRecordQueryKeys.followups(recordId, { page, page_size: 10 }),
    queryFn: () => patientRecordService.listFollowups(recordId, { page, page_size: 10 }),
    enabled: recordId.length > 0,
  });

  const items = listQuery.data?.items ?? [];
  const totalPages = Math.max(1, listQuery.data?.pages ?? 1);
  const errorMessage = listQuery.error ? parseApiError(listQuery.error).message : null;

  const createMutation = useCreateFollowup(recordId);
  const updateMutation = useUpdateFollowup(recordId);
  const deleteMutation = useDeleteFollowup(recordId);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FollowupListItem | null>(null);
  const [deleting, setDeleting] = useState<FollowupListItem | null>(null);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [serverMessage, setServerMessage] = useState<string | null>(null);

  const handleSubmit = (values: FollowupFormValues) => {
    setServerErrors({});
    setServerMessage(null);
    if (editing) {
      updateMutation.mutate(
        {
          id: editing.id,
          payload: followupFormValuesToUpdateRequest(values, {
            followup_date: editing.followup_date,
            notes: editing.notes,
          }),
        },
        {
          onSuccess: () => {
            setFormOpen(false);
            notify('success', 'Follow-up updated');
          },
          onError: (error) => handleError(error),
        },
      );
    } else {
      createMutation.mutate(followupFormValuesToCreateRequest(values), {
        onSuccess: () => {
          setFormOpen(false);
          notify('success', 'Follow-up scheduled');
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
        notify('success', 'Follow-up removed');
      },
      onError: (error) => setServerMessage(parseApiError(error).message),
    });
  };

  const columns: DataTableColumn<FollowupListItem>[] = [
    {
      key: 'followup_date',
      header: 'Follow-up Date',
      render: (row) => <span className="font-medium text-neutral-900">{formatISODate(row.followup_date)}</span>,
    },
    {
      key: 'notes',
      header: 'Notes',
      render: (row) => (
        <span className="block max-w-[320px] truncate text-neutral-600" title={row.notes ?? ''}>
          {row.notes || '—'}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Scheduled',
      render: (row) => <span className="text-neutral-600">{formatISODate(row.created_at)}</span>,
    },
  ];

  return (
    <Card>
      <Card.Header
        title="Follow-ups"
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
              Schedule Follow-up
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
          ariaLabel="Follow-ups"
          emptyTitle="No follow-ups scheduled"
          emptyDescription="Schedule a follow-up visit for this record."
          emptyAction={
            !isFinalized ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setFormOpen(true)}
                leftIcon={<Icon icon={Plus} size="xs" />}
              >
                Schedule Follow-up
              </Button>
            ) : undefined
          }
          rowActionsHeader=""
          rowActions={(row) =>
            !isFinalized ? (
              <div className="flex items-center justify-end gap-1">
                <IconButton
                  icon={<Icon icon={Pencil} size="sm" />}
                  aria-label={`Edit follow-up ${row.followup_date}`}
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
                  aria-label={`Delete follow-up ${row.followup_date}`}
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

      <FollowupFormDialog
        open={formOpen}
        followup={editing}
        submitting={createMutation.isPending || updateMutation.isPending}
        serverErrors={serverErrors}
        serverMessage={serverMessage}
        onSubmit={handleSubmit}
        onClose={() => setFormOpen(false)}
      />

      <FollowupDeleteConfirm
        open={deleting !== null}
        followupDate={deleting?.followup_date ?? null}
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
