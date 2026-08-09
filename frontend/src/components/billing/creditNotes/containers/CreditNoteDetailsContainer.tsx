import { useEffect, useState, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../../common/Card/Card';
import { Button } from '../../../common/Button/Button';
import { ToastContainer, type Toast } from '../../../common/Toast';
import { StatusBadge } from '../../../common/StatusBadge/StatusBadge';
import { CreditNoteSummaryCard } from '../CreditNoteSummaryCard';
import { CreditNoteReasonCard } from '../CreditNoteReasonCard';
import { CreditNoteTimeline, type CreditNoteTimelineItem } from '../CreditNoteTimeline';
import { CreditNoteDetailActions } from '../CreditNoteDetailActions';
import { CreditNoteDetailSkeleton } from '../CreditNoteDetailSkeleton';
import { CreditNoteDetailError } from '../CreditNoteDetailError';
import { CreditNoteDetailPermission } from '../CreditNoteDetailPermission';
import { CreditNoteDetailEmpty } from '../CreditNoteDetailEmpty';
import { IssueCreditNoteDialog } from '../IssueCreditNoteDialog';
import { ApplyCreditNoteDialog } from '../ApplyCreditNoteDialog';
import { VoidCreditNoteDialog } from '../VoidCreditNoteDialog';
import { CreateCreditNoteDrawer } from '../CreateCreditNoteDrawer';
import { CREDIT_NOTE_STATUS_VARIANTS } from '../../../../constants/billing';
import { useCreditNote } from '../../../../hooks/billing/useCreditNote';
import {
  useIssueCreditNote,
  useApplyCreditNote,
  useVoidCreditNote,
  useCreateCreditNote,
} from '../../../../hooks/billing/useCreditNoteMutations';
import { parseApiError } from '../../../../services/apiError';
import { ROUTES } from '../../../../routes/routes';
import { formatCreditNoteDateTime } from '../../../../utils/creditNoteFormatting';

const TOAST_DURATION_MS = 5000;

interface CreditNoteDetailsContainerProps {
  creditNoteId: string;
}

/**
 * CreditNoteDetailsContainer — credit note detail orchestration (Sprint 14A.4).
 *
 * NOTE: The backend currently exposes NO GET /billing/credit-notes/{id} endpoint.
 * Data is supplied exclusively from mutation responses (create/issue/apply/void)
 * via queryClient.setQueryData. This container reads from the TanStack Query cache.
 * If no cached data exists, an empty state is shown.
 */
export const CreditNoteDetailsContainer: FC<CreditNoteDetailsContainerProps> = ({ creditNoteId }) => {
  const navigate = useNavigate();
  const creditNoteQuery = useCreditNote(creditNoteId);
  const creditNote = creditNoteQuery.data;

  const [toast, setToast] = useState<Toast | null>(null);

  /* ── Dialog state ────────────────────────────────────────────── */
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  /* ── Mutations ───────────────────────────────────────────────── */
  const issueMutation = useIssueCreditNote();
  const applyMutation = useApplyCreditNote();
  const voidMutation = useVoidCreditNote();
  const createMutation = useCreateCreditNote();

  // Auto-dismiss the transient toast.
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const showToast = (variant: Toast['variant'], title: string, description?: string) => {
    setToast({ id: `cn-${Date.now()}`, variant, title, description });
  };

  /* ── States ──────────────────────────────────────────────────── */

  if (creditNoteQuery.isLoading) {
    return <CreditNoteDetailSkeleton />;
  }

  if (creditNoteQuery.isError) {
    const info = parseApiError(creditNoteQuery.error);
    if (info.kind === 'forbidden') return <CreditNoteDetailPermission />;
    return (
      <CreditNoteDetailError
        creditNoteNumber={null}
        onRetry={() => void creditNoteQuery.refetch()}
        onBack={() => navigate(ROUTES.BILLING_INVOICES)}
      />
    );
  }

  const cn = creditNote;
  if (!cn) {
    return (
      <CreditNoteDetailEmpty
        onBack={() => navigate(ROUTES.BILLING_INVOICES)}
        onCreateCreditNote={() => setCreateOpen(true)}
      />
    );
  }

  const backToInvoice = () => navigate(`${ROUTES.BILLING_INVOICES}/${cn.invoice.id}`);

  /* ── Handlers ────────────────────────────────────────────────── */

  const handleIssueConfirm = () => {
    setIssueError(null);
    issueMutation.mutate(cn.id, {
      onSuccess: (issued) => {
        setIssueOpen(false);
        showToast('success', `${issued.credit_note_number} issued`, 'A permanent number has been assigned.');
      },
      onError: (error) => setIssueError(parseApiError(error).message),
    });
  };

  const handleApplyConfirm = () => {
    setApplyError(null);
    applyMutation.mutate(cn.id, {
      onSuccess: (applied) => {
        setApplyOpen(false);
        showToast('success', `${applied.credit_note_number} applied`, `Applied to ${applied.invoice.invoice_number}`);
      },
      onError: (error) => setApplyError(parseApiError(error).message),
    });
  };

  const handleVoidConfirm = (reason: string) => {
    setVoidError(null);
    voidMutation.mutate(
      { id: cn.id, payload: { void_reason: reason } },
      {
        onSuccess: (voided) => {
          setVoidOpen(false);
          showToast('success', `${voided.credit_note_number} voided`);
        },
        onError: (error) => setVoidError(parseApiError(error).message),
      },
    );
  };

  const handleCreateCreditNote = (values: { invoice_id: string; patient_id: string; amount: string; reason: string; expiry_date?: string }) => {
    setCreateError(null);
    createMutation.mutate(
      {
        invoice_id: values.invoice_id,
        patient_id: values.patient_id,
        amount: values.amount,
        reason: values.reason,
        expiry_date: values.expiry_date || undefined,
      },
      {
        onSuccess: (created) => {
          setCreateOpen(false);
          showToast('success', `${created.credit_note_number} created`, 'Saved as draft');
        },
        onError: (error) => setCreateError(parseApiError(error).message),
      },
    );
  };

  const actionsSubmitting =
    issueMutation.isPending ||
    applyMutation.isPending ||
    voidMutation.isPending;

  /* ── Timeline items ──────────────────────────────────────────── */
  const timelineItems: CreditNoteTimelineItem[] = cn.audit_trail.map((event) => {
    let iconColor = 'border-neutral-300 text-neutral-400';

    if (event.action === 'created') {
      iconColor = 'border-neutral-300 text-neutral-400';
    } else if (event.action === 'issued') {
      iconColor = 'border-primary-500 text-primary-500';
    } else if (event.action === 'credit_applied') {
      iconColor = 'border-success text-success';
    } else if (event.action === 'voided') {
      iconColor = 'border-danger text-danger';
    }

    return {
      title: event.action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      description: event.performed_by.full_name
        ? `${event.performed_by.full_name}${event.reason ? ` · ${event.reason}` : ''}`
        : event.reason ?? undefined,
      timestamp: formatCreditNoteDateTime(event.occurred_at),
      iconColor,
    };
  });

  // Add terminal "not applicable" entry if the credit note was applied.
  if (cn.status === 'applied') {
    timelineItems.push({
      title: 'Void',
      description: 'Not applicable — this credit note was applied',
      isNotApplicable: true,
    });
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      {/* Header */}
      <Card>
        <Card.Body>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="ghost" size="sm" onClick={backToInvoice}>
                  ← Back to Invoice {cn.invoice.invoice_number}
                </Button>
                <h1 className="text-h2 font-semibold tracking-tight text-neutral-900">
                  {cn.credit_note_number}
                </h1>
                <StatusBadge status={cn.status} statusMap={CREDIT_NOTE_STATUS_VARIANTS} />
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-caption font-medium text-neutral-600">
                  v{cn.version}
                </span>
              </div>
              <p className="mt-2 text-body-sm text-neutral-500">
                {cn.patient.full_name}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <CreditNoteDetailActions
                status={cn.status}
                submitting={actionsSubmitting}
                onIssue={() => setIssueOpen(true)}
                onApply={() => setApplyOpen(true)}
                onVoid={() => setVoidOpen(true)}
              />
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* Main content grid */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <Card.Header title="Credit Note Timeline" />
            <Card.Body>
              <CreditNoteTimeline items={timelineItems} />
            </Card.Body>
          </Card>
        </div>
        <div className="space-y-6">
          <CreditNoteSummaryCard creditNote={cn} />
          <CreditNoteReasonCard reason={cn.reason} />
        </div>
      </div>

      {/* ── Dialogs ─────────────────────────────────────────────── */}
      <CreateCreditNoteDrawer
        key={createOpen ? 'open' : 'closed'}
        open={createOpen}
        defaultInvoiceId={cn.invoice.id}
        defaultPatientId={cn.patient.id}
        onClose={() => {
          setCreateOpen(false);
          setCreateError(null);
        }}
        onSubmit={handleCreateCreditNote}
        submitting={createMutation.isPending}
        serverMessage={createError}
      />

      <IssueCreditNoteDialog
        open={issueOpen}
        creditNote={cn}
        submitting={issueMutation.isPending}
        error={issueError}
        onConfirm={handleIssueConfirm}
        onClose={() => {
          setIssueOpen(false);
          setIssueError(null);
        }}
      />

      <ApplyCreditNoteDialog
        open={applyOpen}
        creditNote={cn}
        submitting={applyMutation.isPending}
        error={applyError}
        onConfirm={handleApplyConfirm}
        onClose={() => {
          setApplyOpen(false);
          setApplyError(null);
        }}
      />

      <VoidCreditNoteDialog
        open={voidOpen}
        creditNote={cn}
        submitting={voidMutation.isPending}
        error={voidError}
        onConfirm={handleVoidConfirm}
        onClose={() => {
          setVoidOpen(false);
          setVoidError(null);
        }}
      />

      {toast && (
        <ToastContainer toasts={[toast]} position="top-right" onDismiss={() => setToast(null)} />
      )}
    </div>
  );
};
