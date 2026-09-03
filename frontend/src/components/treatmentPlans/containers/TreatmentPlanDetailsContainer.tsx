import { useEffect, useMemo, useState, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../common/Card/Card';
import { Button } from '../../common/Button/Button';
import { Tabs } from '../../common/Tabs/Tabs';
import { Alert } from '../../common/Alert/Alert';
import { ResultState } from '../../common/ResultState/ResultState';
import { Skeleton } from '../../common/Skeleton/Skeleton';
import { ToastContainer, type Toast } from '../../common/Toast';
import { TreatmentPlanStatusBadge } from '../TreatmentPlanStatusBadge';
import { WorkflowProgressBar } from '../WorkflowProgressBar';
import { PlanTransitionActions } from '../PlanTransitionActions';
import { TreatmentPlanItemsTable } from '../TreatmentPlanItemsTable';
import { ApprovalStatusCard } from '../ApprovalStatusCard';
import { VersionTimeline } from '../VersionTimeline';
import { PlanActivityCard } from '../PlanActivityCard';
import { ProgressSummaryCard } from '../ProgressSummaryCard';
import { ItemDetailsDrawer } from '../ItemDetailsDrawer';
import { AddItemDialog } from '../dialogs/AddItemDialog';
import { UpdateItemDialog } from '../dialogs/UpdateItemDialog';
import { RemoveItemConfirm } from '../dialogs/RemoveItemConfirm';
import { ReorderItemsDialog } from '../dialogs/ReorderItemsDialog';
import { ConfirmTransitionDialog } from '../dialogs/ConfirmTransitionDialog';
import { CancelPlanDialog } from '../dialogs/CancelPlanDialog';
import { CreateVersionDialog } from '../dialogs/CreateVersionDialog';
import { RestoreVersionDialog } from '../dialogs/RestoreVersionDialog';
import { DoctorApproveDialog, DoctorRevokeDialog, PatientAcknowledgeDialog, PatientDeclineDialog } from '../dialogs/ApprovalDialogs';
import { useTreatmentPlan } from '../../../hooks/treatmentPlans/useTreatmentPlan';
import { useTreatmentPlanNames } from '../../../hooks/treatmentPlans/useTreatmentPlanNames';
import { useActiveProcedures } from '../../../hooks/procedures/useActiveProcedures';
import { useAddItem, useUpdateItem, useRemoveItem, useReorderItems } from '../../../hooks/treatmentPlans/useTreatmentPlanItemMutations';
import { useSubmitForReview, useApproveReview, useRejectReview, useAcceptPlan, useDeclinePlan, useCancelPlan, useStartTreatment, usePutOnHold, useResumeTreatment, useCompletePlan } from '../../../hooks/treatmentPlans/useTreatmentPlanTransitionMutations';
import { useDoctorApprove, useDoctorRevoke, usePatientAcknowledge, usePatientDecline } from '../../../hooks/treatmentPlans/useTreatmentPlanApprovalMutations';
import { useCreateVersion, useRestoreVersion } from '../../../hooks/treatmentPlans/useTreatmentPlanVersionMutations';
import { isEditableStatus } from '../../../utils/treatmentPlanStateMachine';
import { itemFormValuesToAddRequest, itemFormValuesToUpdateRequest } from '../itemFormUtils';
import { parseApiError } from '../../../services/apiError';
import { formatISODate } from '../../../utils/date';
import { ROUTES } from '../../../routes/routes';
import type {
  ItemFormValues,
  TreatmentPlanActionId,
  TreatmentPlanItemResponse,
  VersionListItem,
} from '../../../types/treatmentPlan';

/** Toast lifetime before auto-dismiss (ms). */
const TOAST_DURATION_MS = 5000;

/** Approval dialog intents. */
type ApprovalIntent = 'doctor-approve' | 'doctor-revoke' | 'patient-acknowledge' | 'patient-decline' | null;

/**
 * TreatmentPlanDetailsContainer — S-02 orchestration ([MAP §3.2]).
 *
 * Fetches the plan aggregate (single query — items, approval, versions all
 * embedded), owns all lifecycle/approval/item/version dialogs, the tabs
 * (Plan Details / History / Approval Status) and name enrichment. 404 →
 * ResultState; the action bar renders endpoint-backed transitions only.
 */
export const TreatmentPlanDetailsContainer: FC<{ planId: string }> = ({ planId }) => {
  const navigate = useNavigate();
  const planQuery = useTreatmentPlan(planId);
  const plan = planQuery.data;

  // Stable id arrays (memoised) — the names query key derives from these, so
  // recreating them each render would churn the cache key (mirrors the
  // appointments container's memoisation pattern).
  const patientId = planQuery.data?.patient_id ?? null;
  const doctorId = planQuery.data?.doctor_id ?? null;
  const nameIds = useMemo(
    () => ({ patientIds: patientId ? [patientId] : [], doctorIds: doctorId ? [doctorId] : [] }),
    [patientId, doctorId],
  );
  const names = useTreatmentPlanNames(nameIds.patientIds, nameIds.doctorIds);
  const patientName = plan ? (names.data?.patientNames.get(plan.patient_id) ?? null) : null;
  const doctorName = plan ? (names.data?.doctorNames.get(plan.doctor_id) ?? null) : null;

  const activeProcedures = useActiveProcedures();
  const procedureOptions = useMemo(
    () =>
      (activeProcedures.data ?? []).map((p) => ({
        value: String(p.id),
        label: `${p.code} — ${p.name}`,
      })),
    [activeProcedures.data],
  );
  // procedure_id → default_cost, for the add-item cost hint (architecture §10).
  const procedureCostMap = useMemo(
    () =>
      Object.fromEntries(
        (activeProcedures.data ?? []).map((p) => [String(p.id), p.default_cost]),
      ),
    [activeProcedures.data],
  );

  // Plan Summary values are DERIVED from the embedded items — the detail
  // aggregate does not carry `item_count` / `total_estimated_cost` (those are
  // list-only fields, [BCR §9.3]; see F-01). Decimal-as-number (JSON wire
  // format) sums directly; snapshot payloads use strings instead.
  const planSummary = useMemo(() => {
    if (!planQuery.data) return { itemCount: 0, totalEstimatedCost: 0 };
    return {
      itemCount: planQuery.data.items.length,
      totalEstimatedCost: planQuery.data.items.reduce(
        (sum, item) => sum + Number(item.estimated_cost ?? 0) * (item.quantity ?? 1),
        0,
      ),
    };
  }, [planQuery.data]);

  /* ── Dialog state ─────────────────────────────────────────────── */
  const [activeTab, setActiveTab] = useState('details');
  const [transition, setTransition] = useState<TreatmentPlanActionId | null>(null);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [addItemOpen, setAddItemOpen] = useState(false);
  const [addItemError, setAddItemError] = useState<string | null>(null);
  const [addItemFieldErrors, setAddItemFieldErrors] = useState<Record<string, string>>({});
  const [editingItem, setEditingItem] = useState<TreatmentPlanItemResponse | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateFieldErrors, setUpdateFieldErrors] = useState<Record<string, string>>({});
  const [removingItem, setRemovingItem] = useState<TreatmentPlanItemResponse | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [reorderOpen, setReorderOpen] = useState(false);
  const [reorderError, setReorderError] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<TreatmentPlanItemResponse | null>(null);
  const [notesError, setNotesError] = useState<string | null>(null);

  const [versionOpen, setVersionOpen] = useState(false);
  const [versionError, setVersionError] = useState<string | null>(null);
  const [restoringVersion, setRestoringVersion] = useState<VersionListItem | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const [approvalIntent, setApprovalIntent] = useState<ApprovalIntent>(null);
  const [approvalError, setApprovalError] = useState<string | null>(null);

  const [toast, setToast] = useState<Toast | null>(null);

  /* ── Mutations ────────────────────────────────────────────────── */
  const addItemMutation = useAddItem();
  const updateItemMutation = useUpdateItem();
  const removeItemMutation = useRemoveItem();
  const reorderMutation = useReorderItems();

  const submitMutation = useSubmitForReview();
  const approveReviewMutation = useApproveReview();
  const rejectReviewMutation = useRejectReview();
  const acceptMutation = useAcceptPlan();
  const declineMutation = useDeclinePlan();
  const cancelMutation = useCancelPlan();
  const startMutation = useStartTreatment();
  const holdMutation = usePutOnHold();
  const resumeMutation = useResumeTreatment();
  const completeMutation = useCompletePlan();

  const doctorApproveMutation = useDoctorApprove();
  const doctorRevokeMutation = useDoctorRevoke();
  const patientAcknowledgeMutation = usePatientAcknowledge();
  const patientDeclineMutation = usePatientDecline();

  const createVersionMutation = useCreateVersion();
  const restoreVersionMutation = useRestoreVersion();

  // Auto-dismiss toast.
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const transitionSubmitting =
    submitMutation.isPending ||
    approveReviewMutation.isPending ||
    rejectReviewMutation.isPending ||
    acceptMutation.isPending ||
    declineMutation.isPending ||
    cancelMutation.isPending ||
    startMutation.isPending ||
    holdMutation.isPending ||
    resumeMutation.isPending ||
    completeMutation.isPending ||
    doctorApproveMutation.isPending ||
    doctorRevokeMutation.isPending ||
    patientAcknowledgeMutation.isPending ||
    patientDeclineMutation.isPending;

  /* ── Loading / error states ───────────────────────────────────── */
  if (planQuery.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton variant="title" className="w-64" />
        <Skeleton variant="card" />
        <Skeleton variant="card" />
      </div>
    );
  }

  if (planQuery.isError || !plan) {
    const message = planQuery.error ? parseApiError(planQuery.error).message : 'Treatment plan not found.';
    return (
      <ResultState
        variant="error"
        title="Treatment plan unavailable"
        description={message}
        actions={
          <Button variant="primary" onClick={() => navigate(ROUTES.TREATMENT_PLANS)}>
            Back to Treatment Plans
          </Button>
        }
      />
    );
  }

  const editable = isEditableStatus(plan.status);
  const isProposed = plan.status === 'proposed';

  const handleTransitionConfirm = () => {
    if (!transition) return;
    setTransitionError(null);
    const options = {
      onSuccess: () => {
        setTransition(null);
        setToast({ id: `tp-${Date.now()}`, variant: 'success', title: `${plan.plan_code} updated` });
      },
      onError: (error: Error) => {
        setTransitionError(parseApiError(error).message);
      },
    };
    switch (transition) {
      case 'submit-for-review':
        submitMutation.mutate(plan.id, options);
        break;
      case 'approve-review':
        approveReviewMutation.mutate(plan.id, options);
        break;
      case 'reject-review':
        rejectReviewMutation.mutate(plan.id, options);
        break;
      case 'accept':
        acceptMutation.mutate(plan.id, options);
        break;
      case 'decline':
        declineMutation.mutate(plan.id, options);
        break;
      case 'start-treatment':
        startMutation.mutate(plan.id, options);
        break;
      case 'hold':
        holdMutation.mutate(plan.id, options);
        break;
      case 'resume':
        resumeMutation.mutate(plan.id, options);
        break;
      case 'complete':
        completeMutation.mutate(plan.id, options);
        break;
      default:
        // cancel + approval actions have dedicated dialogs.
        setTransition(null);
    }
  };

  const handleCancelConfirm = () => {
    setCancelError(null);
    cancelMutation.mutate(plan.id, {
      onSuccess: () => {
        setCancelOpen(false);
        setToast({ id: `tp-${Date.now()}`, variant: 'success', title: `${plan.plan_code} cancelled` });
      },
      onError: (error) => setCancelError(parseApiError(error).message),
    });
  };

  const handleAddItem = (values: ItemFormValues) => {
    setAddItemError(null);
    setAddItemFieldErrors({});
    addItemMutation.mutate(
      { planId: plan.id, payload: itemFormValuesToAddRequest(values) },
      {
        onSuccess: () => {
          setAddItemOpen(false);
          setToast({ id: `tp-${Date.now()}`, variant: 'success', title: 'Item added' });
        },
        onError: (error) => {
          const info = parseApiError(error);
          if (info.kind === 'validation' && Object.keys(info.fieldErrors).length > 0) {
            setAddItemFieldErrors(info.fieldErrors);
          } else {
            setAddItemError(info.message);
          }
        },
      },
    );
  };

  const handleUpdateItem = (values: ItemFormValues) => {
    if (!editingItem) return;
    setUpdateError(null);
    setUpdateFieldErrors({});
    updateItemMutation.mutate(
      {
        planId: plan.id,
        itemId: editingItem.id,
        payload: itemFormValuesToUpdateRequest(values, editingItem),
      },
      {
        onSuccess: () => {
          setEditingItem(null);
          setToast({ id: `tp-${Date.now()}`, variant: 'success', title: 'Item updated' });
        },
        onError: (error) => {
          const info = parseApiError(error);
          if (info.kind === 'validation' && Object.keys(info.fieldErrors).length > 0) {
            setUpdateFieldErrors(info.fieldErrors);
          } else {
            setUpdateError(info.message);
          }
        },
      },
    );
  };

  const handleRemoveConfirm = () => {
    if (!removingItem) return;
    setRemoveError(null);
    removeItemMutation.mutate(
      { planId: plan.id, itemId: removingItem.id },
      {
        onSuccess: () => {
          setRemovingItem(null);
          setToast({ id: `tp-${Date.now()}`, variant: 'success', title: 'Item removed' });
        },
        onError: (error) => setRemoveError(parseApiError(error).message),
      },
    );
  };

  const handleReorderConfirm = (orderedIds: string[]) => {
    setReorderError(null);
    reorderMutation.mutate(
      { planId: plan.id, itemIds: orderedIds },
      {
        onSuccess: () => {
          setReorderOpen(false);
          setToast({ id: `tp-${Date.now()}`, variant: 'success', title: 'Order updated' });
        },
        onError: (error) => setReorderError(parseApiError(error).message),
      },
    );
  };

  const handleSaveNotes = (notes: string) => {
    if (!detailItem) return;
    setNotesError(null);
    updateItemMutation.mutate(
      { planId: plan.id, itemId: detailItem.id, payload: { notes } },
      {
        onSuccess: () => {
          setToast({ id: `tp-${Date.now()}`, variant: 'success', title: 'Notes saved' });
        },
        onError: (error) => setNotesError(parseApiError(error).message),
      },
    );
  };

  const handleApprovalConfirm = () => {
    if (!approvalIntent) return;
    setApprovalError(null);
    const options = {
      onSuccess: () => {
        setApprovalIntent(null);
        setToast({ id: `tp-${Date.now()}`, variant: 'success', title: 'Approval status updated' });
      },
      onError: (error: Error) => setApprovalError(parseApiError(error).message),
    };
    switch (approvalIntent) {
      case 'doctor-approve':
        doctorApproveMutation.mutate(plan.id, options);
        break;
      case 'doctor-revoke':
        doctorRevokeMutation.mutate(plan.id, options);
        break;
      case 'patient-acknowledge':
        patientAcknowledgeMutation.mutate(plan.id, options);
        break;
      case 'patient-decline':
        patientDeclineMutation.mutate(plan.id, options);
        break;
    }
  };

  const handleCreateVersion = (changeReason: string) => {
    setVersionError(null);
    createVersionMutation.mutate(
      { planId: plan.id, changeReason },
      {
        onSuccess: () => {
          setVersionOpen(false);
          setToast({ id: `tp-${Date.now()}`, variant: 'success', title: 'Version created' });
        },
        onError: (error) => setVersionError(parseApiError(error).message),
      },
    );
  };

  const handleRestoreConfirm = () => {
    if (!restoringVersion) return;
    setRestoreError(null);
    restoreVersionMutation.mutate(
      { planId: plan.id, versionId: restoringVersion.id },
      {
        onSuccess: () => {
          setRestoringVersion(null);
          setToast({ id: `tp-${Date.now()}`, variant: 'success', title: `Version ${restoringVersion.version_number} restored` });
        },
        onError: (error) => setRestoreError(parseApiError(error).message),
      },
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header card */}
      <Card>
        <Card.Body>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => navigate(ROUTES.TREATMENT_PLANS)}>
                  ← Back
                </Button>
                <h1 className="text-h2 font-semibold tracking-tight text-neutral-900">{plan.plan_code}</h1>
                <TreatmentPlanStatusBadge status={plan.status} />
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-caption font-medium text-neutral-600">
                  v{plan.current_version}
                </span>
              </div>
              <p className="mt-2 text-body-sm text-neutral-500">
                {patientName ?? `Patient #${plan.patient_id}`} · {doctorName ?? `Doctor #${plan.doctor_id}`}
              </p>
              <p className="mt-0.5 text-caption text-neutral-400">
                Created {formatISODate(plan.created_at)}
                {plan.valid_from ? ` · Valid ${formatISODate(plan.valid_from)}${plan.valid_to ? ` – ${formatISODate(plan.valid_to)}` : ''}` : ''}
              </p>
            </div>
            <PlanTransitionActions
              status={plan.status}
              approval={plan.approval}
              submitting={transitionSubmitting}
              onAction={(action) => {
                setTransitionError(null);
                if (action === 'cancel') {
                  setCancelOpen(true);
                } else if (
                  action === 'doctor-approve' ||
                  action === 'doctor-revoke' ||
                  action === 'patient-acknowledge' ||
                  action === 'patient-decline'
                ) {
                  // Approval actions route to their dedicated confirm dialogs
                  // (same surface as the Approval Status tab card).
                  setApprovalError(null);
                  setApprovalIntent(action);
                } else {
                  setTransition(action);
                }
              }}
            />
          </div>
        </Card.Body>
      </Card>

      <WorkflowProgressBar status={plan.status} />

      <Tabs value={activeTab} onValueChange={setActiveTab} variant="underline">
        <Tabs.List>
          <Tabs.Trigger value="details" label="Plan Details" />
          <Tabs.Trigger value="history" label="History" badge={plan.versions.length || undefined} />
          <Tabs.Trigger value="approval" label="Approval Status" />
        </Tabs.List>

        {/* ── Plan Details ─────────────────────────────────────── */}
        <Tabs.Content value="details" className="mt-4">
          <div className="flex flex-col gap-4">
            <Card>
              <Card.Header title="Clinical Information" />
              <Card.Body>
                <dl className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <dt className="text-caption font-medium uppercase tracking-wide text-neutral-500">Clinical Notes</dt>
                    <dd className="mt-1 text-body text-neutral-800">{plan.clinical_notes || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-caption font-medium uppercase tracking-wide text-neutral-500">Observations</dt>
                    <dd className="mt-1 text-body text-neutral-800">{plan.observations || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-caption font-medium uppercase tracking-wide text-neutral-500">Recommendations</dt>
                    <dd className="mt-1 text-body text-neutral-800">{plan.dentist_recommendations || '—'}</dd>
                  </div>
                </dl>
                {!editable && (
                  <Alert
                    variant="info"
                    className="mt-4"
                    title="Plan header is read-only"
                    description="Clinical fields were set at creation and cannot be edited (backend contract)."
                  />
                )}
              </Card.Body>
            </Card>

            <ProgressSummaryCard
              itemCount={planSummary.itemCount}
              totalEstimatedCost={planSummary.totalEstimatedCost}
            />

            <Card>
              <Card.Header
                title="Plan Items"
                actions={
                  editable ? (
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setReorderOpen(true)}>
                        Reorder
                      </Button>
                      <Button variant="primary" size="sm" onClick={() => setAddItemOpen(true)}>
                        + Add Item
                      </Button>
                    </div>
                  ) : undefined
                }
              />
              <Card.Body>
                <TreatmentPlanItemsTable
                  items={plan.items}
                  editable={editable}
                  onAddItem={() => setAddItemOpen(true)}
                  onEditItem={(item) => {
                    setUpdateError(null);
                    setUpdateFieldErrors({});
                    setEditingItem(item);
                  }}
                  onRemoveItem={(item) => {
                    setRemoveError(null);
                    setRemovingItem(item);
                  }}
                  onRowClick={(item) => {
                    setNotesError(null);
                    setDetailItem(item);
                  }}
                />
              </Card.Body>
            </Card>

            <PlanActivityCard plan={plan} />
          </div>
        </Tabs.Content>

        {/* ── History ──────────────────────────────────────────── */}
        <Tabs.Content value="history" className="mt-4">
          <Card>
            <Card.Header
              title="Version History"
              actions={
                editable ? (
                  <Button variant="primary" size="sm" onClick={() => setVersionOpen(true)}>
                    Create Version
                  </Button>
                ) : undefined
              }
            />
            <Card.Body>
              <VersionTimeline
                planId={plan.id}
                versions={plan.versions}
                canRestore={editable}
                submitting={restoreVersionMutation.isPending}
                onRestore={(version) => {
                  setRestoreError(null);
                  setRestoringVersion(version);
                }}
              />
            </Card.Body>
          </Card>
        </Tabs.Content>

        {/* ── Approval Status ──────────────────────────────────── */}
        <Tabs.Content value="approval" className="mt-4">
          <ApprovalStatusCard
            approval={plan.approval}
            isProposed={isProposed}
            submitting={transitionSubmitting}
            onDoctorApprove={() => setApprovalIntent('doctor-approve')}
            onDoctorRevoke={() => setApprovalIntent('doctor-revoke')}
            onPatientAcknowledge={() => setApprovalIntent('patient-acknowledge')}
            onPatientDecline={() => setApprovalIntent('patient-decline')}
          />
        </Tabs.Content>
      </Tabs>

      {/* ── Dialogs ────────────────────────────────────────────── */}
      <ConfirmTransitionDialog
        open={transition !== null}
        action={transition}
        planCode={plan.plan_code}
        submitting={transitionSubmitting}
        error={transitionError}
        onConfirm={handleTransitionConfirm}
        onClose={() => {
          setTransition(null);
          setTransitionError(null);
        }}
      />

      <CancelPlanDialog
        open={cancelOpen}
        planCode={plan.plan_code}
        submitting={cancelMutation.isPending}
        error={cancelError}
        onConfirm={handleCancelConfirm}
        onClose={() => {
          setCancelOpen(false);
          setCancelError(null);
        }}
      />

      <AddItemDialog
        open={addItemOpen}
        onClose={() => {
          setAddItemOpen(false);
          setAddItemError(null);
          setAddItemFieldErrors({});
        }}
        procedureOptions={procedureOptions}
        proceduresLoading={activeProcedures.isLoading}
        procedureCostMap={procedureCostMap}
        onSubmit={handleAddItem}
        submitting={addItemMutation.isPending}
        serverErrors={addItemFieldErrors}
        serverMessage={addItemError}
      />

      <UpdateItemDialog
        key={editingItem?.id ?? 'none'}
        open={editingItem !== null}
        onClose={() => {
          setEditingItem(null);
          setUpdateError(null);
          setUpdateFieldErrors({});
        }}
        item={editingItem}
        procedureOptions={procedureOptions}
        proceduresLoading={activeProcedures.isLoading}
        onSubmit={handleUpdateItem}
        submitting={updateItemMutation.isPending}
        serverErrors={updateFieldErrors}
        serverMessage={updateError}
      />

      <RemoveItemConfirm
        open={removingItem !== null}
        item={removingItem}
        submitting={removeItemMutation.isPending}
        error={removeError}
        onConfirm={handleRemoveConfirm}
        onClose={() => {
          setRemovingItem(null);
          setRemoveError(null);
        }}
      />

      <ReorderItemsDialog
        key={reorderOpen ? 'open' : 'closed'}
        open={reorderOpen}
        items={plan.items}
        submitting={reorderMutation.isPending}
        error={reorderError}
        onConfirm={handleReorderConfirm}
        onClose={() => {
          setReorderOpen(false);
          setReorderError(null);
        }}
      />

      <ItemDetailsDrawer
        key={detailItem?.id ?? 'none'}
        open={detailItem !== null}
        item={detailItem}
        canEditNotes={editable}
        onClose={() => setDetailItem(null)}
        onSaveNotes={handleSaveNotes}
        submitting={updateItemMutation.isPending}
        error={notesError}
      />

      <CreateVersionDialog
        open={versionOpen}
        onSubmit={handleCreateVersion}
        submitting={createVersionMutation.isPending}
        error={versionError}
        onClose={() => {
          setVersionOpen(false);
          setVersionError(null);
        }}
      />

      <RestoreVersionDialog
        open={restoringVersion !== null}
        versionNumber={restoringVersion?.version_number ?? null}
        submitting={restoreVersionMutation.isPending}
        error={restoreError}
        onConfirm={handleRestoreConfirm}
        onClose={() => {
          setRestoringVersion(null);
          setRestoreError(null);
        }}
      />

      <DoctorApproveDialog
        open={approvalIntent === 'doctor-approve'}
        planCode={plan.plan_code}
        submitting={doctorApproveMutation.isPending}
        error={approvalError}
        onConfirm={handleApprovalConfirm}
        onClose={() => {
          setApprovalIntent(null);
          setApprovalError(null);
        }}
      />
      <DoctorRevokeDialog
        open={approvalIntent === 'doctor-revoke'}
        planCode={plan.plan_code}
        submitting={doctorRevokeMutation.isPending}
        error={approvalError}
        onConfirm={handleApprovalConfirm}
        onClose={() => {
          setApprovalIntent(null);
          setApprovalError(null);
        }}
      />
      <PatientAcknowledgeDialog
        open={approvalIntent === 'patient-acknowledge'}
        planCode={plan.plan_code}
        submitting={patientAcknowledgeMutation.isPending}
        error={approvalError}
        onConfirm={handleApprovalConfirm}
        onClose={() => {
          setApprovalIntent(null);
          setApprovalError(null);
        }}
      />
      <PatientDeclineDialog
        open={approvalIntent === 'patient-decline'}
        planCode={plan.plan_code}
        submitting={patientDeclineMutation.isPending}
        error={approvalError}
        onConfirm={handleApprovalConfirm}
        onClose={() => {
          setApprovalIntent(null);
          setApprovalError(null);
        }}
      />

      {toast && (
        <ToastContainer toasts={[toast]} position="top-right" onDismiss={() => setToast(null)} />
      )}
    </div>
  );
};
