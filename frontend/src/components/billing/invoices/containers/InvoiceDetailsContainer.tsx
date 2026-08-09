import { useEffect, useState, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { Card } from '../../../common/Card/Card';
import { Button } from '../../../common/Button/Button';
import { Icon } from '../../../common/Icon/Icon';
import { ToastContainer, type Toast } from '../../../common/Toast';
import { StatusBadge } from '../../../common/StatusBadge/StatusBadge';
import { InvoiceSummaryCards } from '../InvoiceSummaryCards';
import { InvoiceLineItemsTable } from '../InvoiceLineItemsTable';
import { InvoiceFinancialSummaryCard } from '../InvoiceFinancialSummaryCard';
import { InvoiceRecordInfo } from '../InvoiceRecordInfo';
import { InvoiceNotesCard } from '../InvoiceNotesCard';
import { InvoiceDetailActions } from '../InvoiceDetailActions';
import { InvoiceDetailSkeleton } from '../InvoiceDetailSkeleton';
import { InvoiceDetailError } from '../InvoiceDetailError';
import { InvoiceDetailPermission } from '../InvoiceDetailPermission';
import { EditInvoiceDrawer } from '../dialogs/EditInvoiceDrawer';
import { IssueInvoiceDialog } from '../dialogs/IssueInvoiceDialog';
import { CancelInvoiceDialog } from '../dialogs/CancelInvoiceDialog';
import { DeleteInvoiceDialog } from '../dialogs/DeleteInvoiceDialog';
import { CreateCreditNoteDrawer } from '../../creditNotes/CreateCreditNoteDrawer';
import { INVOICE_STATUS_VARIANTS } from '../../../../constants/billing';
import { useInvoice } from '../../../../hooks/billing/useInvoice';
import {
  useUpdateDraftInvoice,
  useIssueInvoice,
  useCancelInvoice,
  useDeleteInvoice,
} from '../../../../hooks/billing/useInvoiceMutations';
import { useCreateCreditNote } from '../../../../hooks/billing/useCreditNoteMutations';
import { parseApiError } from '../../../../services/apiError';
import { ROUTES } from '../../../../routes/routes';
import { editFormValuesToUpdatePayload } from '../../../../utils/invoiceFormUtils';
import { isDraftInvoice } from '../../../../utils/invoiceStateMachine';
import type { InvoiceEditFormValues } from '../../../../utils/invoiceFormSchema';
import type { InvoiceListItem } from '../../../../types/billing';

/** Toast lifetime before auto-dismiss (ms). */
const TOAST_DURATION_MS = 5000;

/**
 * InvoiceDetailsContainer — invoice detail orchestration (Sprint 14A.2).
 *
 * Fetches the full aggregate (GET /billing/invoices/{id}) and owns the
 * lifecycle actions + dialogs:
 * - Draft        → Issue / Edit / Cancel / Delete (delete admin-gated)
 * - Issued/Partial/Overdue → Cancel
 * - Paid/Terminal → no actions
 *
 * Loading → skeleton layout; 403 → permission state (never retried);
 * error/404 → safe error copy with Retry + Back to invoices.
 */
export const InvoiceDetailsContainer: FC<{ invoiceId: string }> = ({ invoiceId }) => {
  const navigate = useNavigate();
  const invoiceQuery = useInvoice(invoiceId);
  const invoice = invoiceQuery.data;

  const [toast, setToast] = useState<Toast | null>(null);

  /* ── Dialog state ────────────────────────────────────────────── */
  const [editOpen, setEditOpen] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editFieldErrors, setEditFieldErrors] = useState<Record<string, string>>({});
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  /* ── Mutations ───────────────────────────────────────────────── */
  const editMutation = useUpdateDraftInvoice();
  const issueMutation = useIssueInvoice();
  const cancelMutation = useCancelInvoice();
  const deleteMutation = useDeleteInvoice();
  const createCreditNoteMutation = useCreateCreditNote();

  /* ── Credit note drawer state ─────────────────────────────────── */
  const [createCreditNoteOpen, setCreateCreditNoteOpen] = useState(false);
  const [createCreditNoteError, setCreateCreditNoteError] = useState<string | null>(null);

  // Auto-dismiss the transient toast.
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const showToast = (variant: Toast['variant'], title: string, description?: string) => {
    setToast({ id: `inv-${Date.now()}`, variant, title, description });
  };

  /* ── States ──────────────────────────────────────────────────── */

  if (invoiceQuery.isLoading) {
    return <InvoiceDetailSkeleton />;
  }

  if (invoiceQuery.isError) {
    const info = parseApiError(invoiceQuery.error);
    // 403 → permission state; never auto-retried (shouldRetryQuery).
    if (info.kind === 'forbidden') return <InvoiceDetailPermission />;
    return (
      <InvoiceDetailError
        invoiceNumber={null}
        onRetry={() => void invoiceQuery.refetch()}
        onBack={() => navigate(ROUTES.BILLING_INVOICES)}
      />
    );
  }

  if (!invoice) {
    // Reached with no data and no error — treat like a not-found.
    return (
      <InvoiceDetailError
        invoiceNumber={null}
        onRetry={() => void invoiceQuery.refetch()}
        onBack={() => navigate(ROUTES.BILLING_INVOICES)}
      />
    );
  }

  const backToList = () => navigate(ROUTES.BILLING_INVOICES);

  /* ── Handlers ────────────────────────────────────────────────── */

  const handleEditSubmit = (values: InvoiceEditFormValues) => {
    setEditError(null);
    setEditFieldErrors({});
    editMutation.mutate(
      { id: invoice.id, payload: editFormValuesToUpdatePayload(values) },
      {
        onSuccess: (updated) => {
          setEditOpen(false);
          showToast('success', `${updated.invoice_number} updated`);
        },
        onError: (error) => {
          const info = parseApiError(error);
          if (info.kind === 'validation' && Object.keys(info.fieldErrors).length > 0) {
            setEditFieldErrors(info.fieldErrors);
          } else {
            setEditError(info.message);
          }
        },
      },
    );
  };

  const handleIssueConfirm = () => {
    setIssueError(null);
    issueMutation.mutate(invoice.id, {
      onSuccess: (issued) => {
        setIssueOpen(false);
        showToast('success', `${issued.invoice_number} issued`, 'A permanent number has been assigned.');
      },
      onError: (error) => setIssueError(parseApiError(error).message),
    });
  };

  const handleCancelConfirm = (reason: string) => {
    setCancelError(null);
    cancelMutation.mutate(
      { id: invoice.id, payload: { cancellation_reason: reason } },
      {
        onSuccess: (cancelled) => {
          setCancelOpen(false);
          showToast('success', `${cancelled.invoice_number} cancelled`);
        },
        onError: (error) => setCancelError(parseApiError(error).message),
      },
    );
  };

  const handleDeleteConfirm = () => {
    setDeleteError(null);
    deleteMutation.mutate(invoice.id, {
      onSuccess: () => {
        setDeleteOpen(false);
        showToast('success', 'Draft deleted', 'The draft invoice was permanently removed.');
        navigate(ROUTES.BILLING_INVOICES);
      },
      onError: (error) => setDeleteError(parseApiError(error).message),
    });
  };

  const handleCreateCreditNote = (values: { invoice_id: string; patient_id: string; amount: string; reason: string; expiry_date?: string }) => {
    setCreateCreditNoteError(null);
    createCreditNoteMutation.mutate(
      {
        invoice_id: values.invoice_id,
        patient_id: values.patient_id,
        amount: values.amount,
        reason: values.reason,
        expiry_date: values.expiry_date || undefined,
      },
      {
        onSuccess: (created) => {
          setCreateCreditNoteOpen(false);
          showToast('success', `${created.credit_note_number} created`, 'Saved as draft');
        },
        onError: (error) => setCreateCreditNoteError(parseApiError(error).message),
      },
    );
  };

  const actionsSubmitting =
    editMutation.isPending ||
    issueMutation.isPending ||
    cancelMutation.isPending ||
    deleteMutation.isPending ||
    createCreditNoteMutation.isPending;

  // The lifecycle dialogs accept a list-shaped invoice (patient + financials
  // + item_count); the detail aggregate carries items instead of item_count.
  const dialogInvoice: InvoiceListItem = {
    ...invoice,
    item_count: invoice.items.length,
  };

  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      {/* Header */}
      <Card>
        <Card.Body>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="ghost" size="sm" onClick={backToList}>
                  ← Back to Invoices
                </Button>
                <h1
                  className={`text-h2 font-semibold tracking-tight ${
                    isDraftInvoice(invoice.status)
                      ? 'text-neutral-500'
                      : 'text-neutral-900'
                  }`}
                >
                  {invoice.invoice_number}
                </h1>
                <StatusBadge status={invoice.status} statusMap={INVOICE_STATUS_VARIANTS} />
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-caption font-medium text-neutral-600">
                  v{invoice.version}
                </span>
              </div>
              <p className="mt-2 text-body-sm text-neutral-500">
                {invoice.patient.full_name}
                {invoice.doctor?.user_full_name ? ` · ${invoice.doctor.user_full_name}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setCreateCreditNoteOpen(true)}
                disabled={actionsSubmitting}
                leftIcon={<Icon icon={FileText} size="xs" />}
              >
                Create credit note
              </Button>
              <InvoiceDetailActions
                status={invoice.status}
                submitting={actionsSubmitting}
                onIssue={() => {
                  setIssueError(null);
                  setIssueOpen(true);
                }}
                onEdit={() => {
                  setEditError(null);
                  setEditFieldErrors({});
                  setEditOpen(true);
                }}
                onCancel={() => {
                  setCancelError(null);
                  setCancelOpen(true);
                }}
                onDelete={() => {
                  setDeleteError(null);
                  setDeleteOpen(true);
                }}
              />
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* Summary cards */}
      <InvoiceSummaryCards invoice={invoice} />

      {/* Line items + financial summary */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <Card.Header title="Line Items" />
            <Card.Body>
              <InvoiceLineItemsTable items={invoice.items} />
            </Card.Body>
          </Card>
        </div>
        <InvoiceFinancialSummaryCard financials={invoice.financials} />
      </div>

      {/* Record info + notes */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <InvoiceRecordInfo invoice={invoice} />
        <InvoiceNotesCard invoice={invoice} />
      </div>

      {/* ── Dialogs ─────────────────────────────────────────────── */}
      <EditInvoiceDrawer
        key={editOpen ? 'open' : 'closed'}
        open={editOpen}
        invoice={invoice}
        onClose={() => {
          setEditOpen(false);
          setEditError(null);
          setEditFieldErrors({});
        }}
        onSubmit={handleEditSubmit}
        submitting={editMutation.isPending}
        serverErrors={editFieldErrors}
        serverMessage={editError}
      />

      <IssueInvoiceDialog
        open={issueOpen}
        invoice={dialogInvoice}
        submitting={issueMutation.isPending}
        error={issueError}
        onConfirm={handleIssueConfirm}
        onClose={() => {
          setIssueOpen(false);
          setIssueError(null);
        }}
      />

      <CancelInvoiceDialog
        open={cancelOpen}
        invoice={dialogInvoice}
        submitting={cancelMutation.isPending}
        error={cancelError}
        onConfirm={handleCancelConfirm}
        onClose={() => {
          setCancelOpen(false);
          setCancelError(null);
        }}
      />

      <DeleteInvoiceDialog
        open={deleteOpen}
        invoice={dialogInvoice}
        submitting={deleteMutation.isPending}
        error={deleteError}
        onConfirm={handleDeleteConfirm}
        onClose={() => {
          setDeleteOpen(false);
          setDeleteError(null);
        }}
      />

      <CreateCreditNoteDrawer
        key={createCreditNoteOpen ? 'open' : 'closed'}
        open={createCreditNoteOpen}
        defaultInvoiceId={invoice.id}
        defaultPatientId={invoice.patient.id}
        onClose={() => {
          setCreateCreditNoteOpen(false);
          setCreateCreditNoteError(null);
        }}
        onSubmit={handleCreateCreditNote}
        submitting={createCreditNoteMutation.isPending}
        serverMessage={createCreditNoteError}
      />

      {toast && (
        <ToastContainer toasts={[toast]} position="top-right" onDismiss={() => setToast(null)} />
      )}
    </div>
  );
};
