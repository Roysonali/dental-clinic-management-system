import { useEffect, useMemo, useState, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stethoscope, Pill, CalendarClock, Paperclip, Pencil, ArrowRightLeft, Lock, Trash2 } from 'lucide-react';
import { Card } from '../../common/Card/Card';
import { Button } from '../../common/Button/Button';
import { Icon } from '../../common/Icon/Icon';
import { Tabs } from '../../common/Tabs/Tabs';
import { Alert } from '../../common/Alert/Alert';
import { ResultState } from '../../common/ResultState/ResultState';
import { Skeleton } from '../../common/Skeleton/Skeleton';
import { StatCard } from '../../common/StatCard/StatCard';
import { PermissionGate } from '../../rbac/PermissionGate';
import { usePermission } from '../../../hooks/rbac/usePermission';
import { ToastContainer, type Toast } from '../../common/Toast';
import { PatientRecordStatusBadge } from '../PatientRecordStatusBadge';
import { RecordClinicalTab } from '../tabs/RecordClinicalTab';
import { RecordDiagnosesTab } from '../tabs/RecordDiagnosesTab';
import { RecordPrescriptionsTab } from '../tabs/RecordPrescriptionsTab';
import { RecordFollowupsTab } from '../tabs/RecordFollowupsTab';
import { RecordAttachmentsTab } from '../tabs/RecordAttachmentsTab';
import { RecordAuditTab } from '../tabs/RecordAuditTab';
import { EditRecordDrawer } from '../dialogs/EditRecordDrawer';
import { ChangeStatusDialog } from '../dialogs/ChangeStatusDialog';
import { FinalizeRecordDialog } from '../dialogs/FinalizeRecordDialog';
import { DeleteRecordDialog } from '../dialogs/DeleteRecordDialog';
import { usePatientRecord } from '../../../hooks/patientRecords/usePatientRecords';
import { usePatientRecordNames } from '../../../hooks/patientRecords/usePatientRecordNames';
import {
  useChangeRecordStatus,
  useDeletePatientRecord,
  useFinalizePatientRecord,
  useUpdatePatientRecord,
} from '../../../hooks/patientRecords/usePatientRecordMutations';
import { recordFormValuesToUpdateRequest } from '../../../utils/patientRecordFormUtils';
import { parseApiError } from '../../../services/apiError';
import { formatISODate } from '../../../utils/date';
import { ROUTES } from '../../../routes/routes';
import { ROLES } from '../../../constants/roles';
import { isRecordEditable } from '../../../utils/patientRecordStateMachine';
import type { PatientRecordFormValues, RecordStatus } from '../../../types/patientRecord';

/** Toast lifetime before auto-dismiss (ms). */
const TOAST_DURATION_MS = 5000;

/**
 * PatientRecordDetailsContainer — S-02 orchestration ([UI spec S-02]).
 *
 * Fetches the record aggregate (single query — nested children + counts +
 * embedded audit log), resolves display names, and owns the lifecycle
 * actions (Edit / Status / Finalize / Delete), the six tabs and their
 * shared toast. Counts in the stat strip come straight from the backend
 * response (`diagnosis_count` etc.) — never recomputed client-side.
 *
 * RBAC ([UI spec §2.2]): the client can only prove admin membership, so
 * Delete is gated to ADMIN via PermissionGate while Edit/Status/Finalize
 * render for all authenticated users and the backend enforces the ⭐ role
 * set (receptionist → 403) — the established pattern for 🅰 modules.
 */
export const PatientRecordDetailsContainer: FC<{ recordId: string }> = ({ recordId }) => {
  const navigate = useNavigate();
  const recordQuery = usePatientRecord(recordId);
  const record = recordQuery.data;

  const { isAdmin } = usePermission();

  // Resolve patient + appointment names and the audit actors (int user ids
  // from the embedded audit log — best-effort, "User #id" fallback).
  const actorIds = useMemo(() => {
    const ids = new Set<number>();
    if (record) {
      for (const entry of record.audit_logs) ids.add(entry.performed_by);
    }
    return Array.from(ids).sort((a, b) => a - b);
  }, [record]);

  const nameIds = useMemo(
    () => ({
      patientIds: record ? [record.patient_id] : [],
      appointmentIds: record?.appointment_id ? [record.appointment_id] : [],
      userIds: actorIds,
    }),
    [record, actorIds],
  );
  const names = usePatientRecordNames(nameIds.patientIds, nameIds.appointmentIds, nameIds.userIds);
  const patientName = record ? (names.patientNames.get(record.patient_id) ?? null) : null;
  const appointmentNumber = record?.appointment_id
    ? (names.appointmentNumbers.get(record.appointment_id) ?? null)
    : null;

  /* ── Dialog state ─────────────────────────────────────────────── */
  const [activeTab, setActiveTab] = useState('clinical');
  const [editOpen, setEditOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editFieldErrors, setEditFieldErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<Toast | null>(null);

  /* ── Mutations ────────────────────────────────────────────────── */
  const updateMutation = useUpdatePatientRecord();
  const statusMutation = useChangeRecordStatus();
  const finalizeMutation = useFinalizePatientRecord();
  const deleteMutation = useDeletePatientRecord();

  const showToast = (variant: Toast['variant'], title: string, description?: string) => {
    setToast({ id: `prd-${Date.now()}`, variant, title, description });
  };

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const notify: (variant: 'success', title: string, description?: string) => void = showToast;

  /* ── Loading / error states ───────────────────────────────────── */
  if (recordQuery.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton variant="title" className="w-64" />
        <Skeleton variant="card" />
        <Skeleton variant="card" />
      </div>
    );
  }

  if (recordQuery.isError || !record) {
    const message = recordQuery.error
      ? parseApiError(recordQuery.error).message
      : 'Patient record not found.';
    return (
      <ResultState
        variant="error"
        title="Patient record unavailable"
        description={message}
        actions={
          <Button variant="primary" onClick={() => navigate(ROUTES.PATIENT_RECORDS)}>
            Back to Patient Records
          </Button>
        }
      />
    );
  }

  const editable = isRecordEditable(record.is_finalized);

  /* ── Handlers ─────────────────────────────────────────────────── */

  const handleSaveEdit = (values: PatientRecordFormValues) => {
    setActionError(null);
    setEditFieldErrors({});
    updateMutation.mutate(
      { id: record.id, payload: recordFormValuesToUpdateRequest(values, record) },
      {
        onSuccess: () => {
          setEditOpen(false);
          showToast('success', 'Record updated');
        },
        onError: (error) => {
          const info = parseApiError(error);
          if (info.kind === 'validation' && Object.keys(info.fieldErrors).length > 0) {
            setEditFieldErrors(info.fieldErrors);
          } else {
            setActionError(info.message);
          }
        },
      },
    );
  };

  const handleStatusConfirm = (target: RecordStatus) => {
    setActionError(null);
    statusMutation.mutate(
      { id: record.id, newStatus: target },
      {
        onSuccess: () => {
          setStatusOpen(false);
          showToast('success', `Status updated to ${target.replace(/_/g, ' ').toLowerCase()}`);
        },
        onError: (error) => setActionError(parseApiError(error).message),
      },
    );
  };

  const handleFinalizeConfirm = () => {
    setActionError(null);
    finalizeMutation.mutate(record.id, {
      onSuccess: () => {
        setFinalizeOpen(false);
        showToast('success', 'Record finalized — now immutable');
      },
      onError: (error) => setActionError(parseApiError(error).message),
    });
  };

  const handleDeleteConfirm = () => {
    setActionError(null);
    deleteMutation.mutate(record.id, {
      onSuccess: () => {
        setDeleteOpen(false);
        showToast('success', 'Record deleted');
        navigate(ROUTES.PATIENT_RECORDS);
      },
      onError: (error) => setActionError(parseApiError(error).message),
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header card */}
      <Card>
        <Card.Body>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => navigate(ROUTES.PATIENT_RECORDS)}>
                  ← Back
                </Button>
                <h1 className="text-h2 font-semibold tracking-tight text-neutral-900">
                  {patientName ?? `Patient #${record.patient_id.slice(0, 8)}`}
                </h1>
                <PatientRecordStatusBadge status={record.status} isFinalized={record.is_finalized} />
              </div>
              <p className="mt-2 text-body-sm text-neutral-500">
                {record.appointment_id
                  ? (appointmentNumber ?? `Appointment #${record.appointment_id.slice(0, 8)}`)
                  : 'No linked appointment'}
              </p>
              <p className="mt-0.5 text-caption text-neutral-400">
                Created {formatISODate(record.created_at)} · Updated {formatISODate(record.updated_at)}
              </p>
            </div>

            {editable ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setActionError(null);
                    setEditFieldErrors({});
                    setEditOpen(true);
                  }}
                  leftIcon={<Icon icon={Pencil} size="xs" />}
                >
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setActionError(null);
                    setStatusOpen(true);
                  }}
                  leftIcon={<Icon icon={ArrowRightLeft} size="xs" />}
                >
                  Status
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setActionError(null);
                    setFinalizeOpen(true);
                  }}
                  leftIcon={<Icon icon={Lock} size="xs" />}
                >
                  Finalize
                </Button>
                <PermissionGate requiredRoles={[ROLES.ADMIN]}>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      setActionError(null);
                      setDeleteOpen(true);
                    }}
                    leftIcon={<Icon icon={Trash2} size="xs" />}
                  >
                    Delete
                  </Button>
                </PermissionGate>
              </div>
            ) : (
              <Alert
                variant="info"
                className="w-full lg:max-w-sm"
                title="This record is finalized and locked"
                description="Clinical content and all diagnoses, prescriptions, follow-ups, and attachments can no longer be changed."
              />
            )}
          </div>
        </Card.Body>
      </Card>

      {/* Counts strip — straight from the backend response (never recomputed). */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={<Icon icon={Stethoscope} size="md" />}
          title="Diagnoses"
          value={record.diagnosis_count}
          size="sm"
        />
        <StatCard
          icon={<Icon icon={Pill} size="md" />}
          title="Prescriptions"
          value={record.prescription_count}
          size="sm"
        />
        <StatCard
          icon={<Icon icon={CalendarClock} size="md" />}
          title="Follow-ups"
          value={record.followup_count}
          size="sm"
        />
        <StatCard
          icon={<Icon icon={Paperclip} size="md" />}
          title="Attachments"
          value={record.attachment_count}
          size="sm"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} variant="underline">
        <Tabs.List>
          <Tabs.Trigger value="clinical" label="Clinical" />
          <Tabs.Trigger value="diagnoses" label="Diagnoses" badge={record.diagnosis_count || undefined} />
          <Tabs.Trigger value="prescriptions" label="Prescriptions" badge={record.prescription_count || undefined} />
          <Tabs.Trigger value="followups" label="Follow-ups" badge={record.followup_count || undefined} />
          <Tabs.Trigger value="attachments" label="Attachments" badge={record.attachment_count || undefined} />
          <Tabs.Trigger value="audit" label="Audit" badge={record.audit_logs.length || undefined} />
        </Tabs.List>

        <Tabs.Content value="clinical" className="mt-4">
          <RecordClinicalTab record={record} />
        </Tabs.Content>
        {/* L-1: every other tab mounts only when first visited — a finalized-chart
            cold open fires the record query alone instead of all child lists. */}
        <Tabs.Content value="diagnoses" className="mt-4" lazy>
          <RecordDiagnosesTab recordId={record.id} isFinalized={record.is_finalized} notify={notify} />
        </Tabs.Content>
        <Tabs.Content value="prescriptions" className="mt-4" lazy>
          <RecordPrescriptionsTab
            recordId={record.id}
            patientId={record.patient_id}
            patientName={patientName}
            isFinalized={record.is_finalized}
            notify={notify}
          />
        </Tabs.Content>
        <Tabs.Content value="followups" className="mt-4" lazy>
          <RecordFollowupsTab recordId={record.id} isFinalized={record.is_finalized} notify={notify} />
        </Tabs.Content>
        <Tabs.Content value="attachments" className="mt-4" lazy>
          <RecordAttachmentsTab recordId={record.id} isFinalized={record.is_finalized} notify={notify} />
        </Tabs.Content>
        <Tabs.Content value="audit" className="mt-4" lazy>
          <RecordAuditTab auditLogs={record.audit_logs} userNames={names.userNames} />
        </Tabs.Content>
      </Tabs>

      {/* ── Dialogs ─────────────────────────────────────────────── */}
      <EditRecordDrawer
        open={editOpen}
        onClose={() => {
          setEditOpen(false);
          setActionError(null);
          setEditFieldErrors({});
        }}
        record={record}
        patientName={patientName}
        appointmentNumber={appointmentNumber}
        onSubmit={handleSaveEdit}
        submitting={updateMutation.isPending}
        serverErrors={editFieldErrors}
        serverMessage={actionError}
      />

      <ChangeStatusDialog
        open={statusOpen}
        currentStatus={record.status}
        hasChiefComplaint={(record.chief_complaint ?? '').trim().length > 0}
        isAdmin={isAdmin}
        submitting={statusMutation.isPending}
        error={actionError}
        onConfirm={handleStatusConfirm}
        onClose={() => {
          setStatusOpen(false);
          setActionError(null);
        }}
      />

      <FinalizeRecordDialog
        open={finalizeOpen}
        submitting={finalizeMutation.isPending}
        error={actionError}
        onConfirm={handleFinalizeConfirm}
        onClose={() => {
          setFinalizeOpen(false);
          setActionError(null);
        }}
      />

      <DeleteRecordDialog
        open={deleteOpen}
        patientName={patientName}
        submitting={deleteMutation.isPending}
        error={actionError}
        onConfirm={handleDeleteConfirm}
        onClose={() => {
          setDeleteOpen(false);
          setActionError(null);
        }}
      />

      {toast && (
        <ToastContainer toasts={[toast]} position="top-right" onDismiss={() => setToast(null)} />
      )}
    </div>
  );
};
