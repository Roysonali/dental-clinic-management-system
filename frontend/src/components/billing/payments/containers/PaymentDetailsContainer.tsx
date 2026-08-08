import { useEffect, useState, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../../../common/Card/Card';
import { Button } from '../../../common/Button/Button';
import { ToastContainer, type Toast } from '../../../common/Toast';
import { StatusBadge } from '../../../common/StatusBadge/StatusBadge';
import { PaymentOverviewCards } from '../PaymentOverviewCards';
import { PaymentFinancialSummaryCard } from '../PaymentFinancialSummaryCard';
import { PaymentAllocationsCard } from '../PaymentAllocationsCard';
import { PaymentReceiptCard } from '../PaymentReceiptCard';
import { PaymentRecordCard } from '../PaymentRecordCard';
import { PaymentNotesCard } from '../PaymentNotesCard';
import { PaymentDetailActions } from '../PaymentDetailActions';
import { PaymentDetailSkeleton } from '../PaymentDetailSkeleton';
import { PaymentDetailError } from '../PaymentDetailError';
import { PaymentDetailPermission } from '../PaymentDetailPermission';
import { CompletePaymentDialog } from '../dialogs/CompletePaymentDialog';
import { FailPaymentDialog } from '../dialogs/FailPaymentDialog';
import { VoidPaymentDialog } from '../dialogs/VoidPaymentDialog';
import { AllocatePaymentDialog } from '../dialogs/AllocatePaymentDialog';
import { DeallocatePaymentDialog } from '../dialogs/DeallocatePaymentDialog';
import { DeletePaymentDialog } from '../dialogs/DeletePaymentDialog';
import { PAYMENT_STATUS_VARIANTS } from '../../../../constants/billing';
import { usePayment } from '../../../../hooks/billing/usePayment';
import { billingQueryKeys } from '../../../../hooks/billing/billingQueryKeys';
import {
  useCompletePayment,
  useFailPayment,
  useVoidPayment,
  useAllocatePayment,
  useDeallocatePayment,
  useDeletePayment,
  useGenerateReceipt,
} from '../../../../hooks/billing/usePaymentMutations';
import { parseApiError } from '../../../../services/apiError';
import { ROUTES } from '../../../../routes/routes';
import type { PaymentAllocationSummary, ReceiptRead } from '../../../../types/billing';

/** Toast lifetime before auto-dismiss (ms). */
const TOAST_DURATION_MS = 5000;

/**
 * PaymentDetailsContainer — payment detail orchestration (Sprint 14A.3).
 *
 * Fetches the full aggregate (GET /billing/payments/{id}) and owns the
 * lifecycle / allocation / delete dialogs plus receipt generation:
 * - Pending    → Complete / Mark as failed / Void / Delete (admin-gated)
 * - Completed  → Allocate (when unallocated > 0) + Generate receipt
 * - Terminal   → no actions
 *
 * Loading → skeleton layout; 403 → permission state (never retried);
 * error/404 → safe error copy with Retry + Back to payments.
 */
export const PaymentDetailsContainer: FC<{ paymentId: string }> = ({ paymentId }) => {
  const navigate = useNavigate();
  const paymentQuery = usePayment(paymentId);
  const payment = paymentQuery.data;

  const [toast, setToast] = useState<Toast | null>(null);

  /* ── Dialog state ────────────────────────────────────────────── */
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [failOpen, setFailOpen] = useState(false);
  const [failError, setFailError] = useState<string | null>(null);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);
  const [allocateOpen, setAllocateOpen] = useState(false);
  const [allocateError, setAllocateError] = useState<string | null>(null);
  const [deallocateTarget, setDeallocateTarget] = useState<PaymentAllocationSummary | null>(null);
  const [deallocateError, setDeallocateError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);

  /* ── Mutations ───────────────────────────────────────────────── */
  const completeMutation = useCompletePayment();
  const failMutation = useFailPayment();
  const voidMutation = useVoidPayment();
  const allocateMutation = useAllocatePayment();
  const deallocateMutation = useDeallocatePayment();
  const deleteMutation = useDeletePayment();
  const receiptMutation = useGenerateReceipt();

  // The backend has no GET /receipts?payment_id lookup, so the generated
  // receipt lives in the query cache (set by useGenerateReceipt's onSuccess)
  // and is read back reactively via a disabled query on the same key. The
  // placeholder queryFn is never executed (enabled: false) — it only satisfies
  // React Query's requirement that every query declares one.
  const receiptQuery = useQuery<ReceiptRead | null>({
    queryKey: billingQueryKeys.receiptForPayment(paymentId),
    queryFn: () => null,
    enabled: false,
  });
  const receipt = receiptQuery.data ?? null;

  // Auto-dismiss the transient toast.
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const showToast = (variant: Toast['variant'], title: string, description?: string) => {
    setToast({ id: `pay-${Date.now()}`, variant, title, description });
  };

  /* ── States ──────────────────────────────────────────────────── */

  if (paymentQuery.isLoading) {
    return <PaymentDetailSkeleton />;
  }

  if (paymentQuery.isError) {
    const info = parseApiError(paymentQuery.error);
    // 403 → permission state; never auto-retried (shouldRetryQuery).
    if (info.kind === 'forbidden') return <PaymentDetailPermission />;
    return (
      <PaymentDetailError
        paymentNumber={null}
        onRetry={() => void paymentQuery.refetch()}
        onBack={() => navigate(ROUTES.BILLING_PAYMENTS)}
      />
    );
  }

  if (!payment) {
    // Reached with no data and no error — treat like a not-found.
    return (
      <PaymentDetailError
        paymentNumber={null}
        onRetry={() => void paymentQuery.refetch()}
        onBack={() => navigate(ROUTES.BILLING_PAYMENTS)}
      />
    );
  }

  const backToList = () => navigate(ROUTES.BILLING_PAYMENTS);
  const unallocated = Number(payment.financials.unallocated_amount);

  /* ── Handlers ────────────────────────────────────────────────── */

  const handleCompleteConfirm = () => {
    setCompleteError(null);
    completeMutation.mutate(payment.id, {
      onSuccess: (completed) => {
        setCompleteOpen(false);
        showToast('success', `${completed.payment_number} completed`, 'It can now be allocated to invoices.');
      },
      onError: (error) => setCompleteError(parseApiError(error).message),
    });
  };

  const handleFailConfirm = (reason: string) => {
    setFailError(null);
    failMutation.mutate(
      { id: payment.id, payload: reason ? { reason } : {} },
      {
        onSuccess: (failed) => {
          setFailOpen(false);
          showToast('success', `${failed.payment_number} marked as failed`);
        },
        onError: (error) => setFailError(parseApiError(error).message),
      },
    );
  };

  const handleVoidConfirm = (reason: string) => {
    setVoidError(null);
    voidMutation.mutate(
      { id: payment.id, payload: reason ? { reason } : {} },
      {
        onSuccess: (voided) => {
          setVoidOpen(false);
          showToast('success', `${voided.payment_number} voided`);
        },
        onError: (error) => setVoidError(parseApiError(error).message),
      },
    );
  };

  const handleAllocateConfirm = (invoiceId: string, amount: string) => {
    setAllocateError(null);
    allocateMutation.mutate(
      { id: payment.id, payload: { invoice_id: invoiceId, amount } },
      {
        onSuccess: () => {
          setAllocateOpen(false);
          showToast('success', 'Allocation recorded', 'The payment has been applied to the invoice.');
        },
        onError: (error) => setAllocateError(parseApiError(error).message),
      },
    );
  };

  const handleDeallocateConfirm = () => {
    if (!deallocateTarget) return;
    setDeallocateError(null);
    deallocateMutation.mutate(
      { id: payment.id, payload: { invoice_id: deallocateTarget.invoice!.id } },
      {
        onSuccess: () => {
          setDeallocateTarget(null);
          showToast('success', 'Allocation removed', 'The amount returned to the unallocated balance.');
        },
        onError: (error) => setDeallocateError(parseApiError(error).message),
      },
    );
  };

  const handleDeleteConfirm = () => {
    setDeleteError(null);
    deleteMutation.mutate(payment.id, {
      onSuccess: () => {
        setDeleteOpen(false);
        showToast('success', 'Payment deleted', 'The pending payment was permanently removed.');
        navigate(ROUTES.BILLING_PAYMENTS);
      },
      onError: (error) => setDeleteError(parseApiError(error).message),
    });
  };

  const handleGenerateReceipt = () => {
    setReceiptError(null);
    receiptMutation.mutate(
      { payment_id: payment.id },
      {
        onSuccess: (receipt) => {
          showToast('success', `${receipt.receipt_number} generated`);
        },
        onError: (error) => setReceiptError(parseApiError(error).message),
      },
    );
  };

  const actionsSubmitting =
    completeMutation.isPending ||
    failMutation.isPending ||
    voidMutation.isPending ||
    allocateMutation.isPending ||
    deallocateMutation.isPending ||
    deleteMutation.isPending;

  const canAllocate = payment.status === 'completed' && unallocated > 0;

  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      {/* Header */}
      <Card>
        <Card.Body>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="ghost" size="sm" onClick={backToList}>
                  ← Back to Payments
                </Button>
                <h1 className="text-h2 font-semibold tracking-tight text-neutral-900">
                  {payment.payment_number}
                </h1>
                <StatusBadge status={payment.status} statusMap={PAYMENT_STATUS_VARIANTS} />
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-caption font-medium text-neutral-600">
                  v{payment.version}
                </span>
              </div>
              <p className="mt-2 text-body-sm text-neutral-500">
                {payment.patient.full_name}
                {payment.reference_number ? ` · ${payment.reference_number}` : ''}
              </p>
            </div>
            <PaymentDetailActions
              payment={payment}
              submitting={actionsSubmitting}
              onComplete={() => {
                setCompleteError(null);
                setCompleteOpen(true);
              }}
              onFail={() => {
                setFailError(null);
                setFailOpen(true);
              }}
              onVoid={() => {
                setVoidError(null);
                setVoidOpen(true);
              }}
              onAllocate={() => {
                setAllocateError(null);
                setAllocateOpen(true);
              }}
              onDelete={() => {
                setDeleteError(null);
                setDeleteOpen(true);
              }}
            />
          </div>
        </Card.Body>
      </Card>

      {/* Overview cards */}
      <PaymentOverviewCards payment={payment} />

      {/* Main column (allocations + notes) + right column (financials/receipt/record) */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <PaymentAllocationsCard
            allocations={payment.allocations}
            canAllocate={canAllocate}
            onAllocate={() => {
              setAllocateError(null);
              setAllocateOpen(true);
            }}
            onDeallocate={(allocation) => {
              setDeallocateError(null);
              setDeallocateTarget(allocation);
            }}
          />
          <PaymentNotesCard notes={payment.notes} />
        </div>

        <div className="flex flex-col gap-6">
          <PaymentFinancialSummaryCard financials={payment.financials} />
          <PaymentReceiptCard
            receipt={receipt}
            canGenerate={payment.status === 'completed'}
            generating={receiptMutation.isPending}
            error={receiptError}
            onGenerate={handleGenerateReceipt}
          />
          <PaymentRecordCard payment={payment} />
        </div>
      </div>

      {/* ── Dialogs ─────────────────────────────────────────────── */}
      <CompletePaymentDialog
        open={completeOpen}
        payment={payment}
        submitting={completeMutation.isPending}
        error={completeError}
        onConfirm={handleCompleteConfirm}
        onClose={() => {
          setCompleteOpen(false);
          setCompleteError(null);
        }}
      />

      <FailPaymentDialog
        open={failOpen}
        payment={payment}
        submitting={failMutation.isPending}
        error={failError}
        onConfirm={handleFailConfirm}
        onClose={() => {
          setFailOpen(false);
          setFailError(null);
        }}
      />

      <VoidPaymentDialog
        open={voidOpen}
        payment={payment}
        submitting={voidMutation.isPending}
        error={voidError}
        onConfirm={handleVoidConfirm}
        onClose={() => {
          setVoidOpen(false);
          setVoidError(null);
        }}
      />

      <AllocatePaymentDialog
        open={allocateOpen}
        payment={payment}
        submitting={allocateMutation.isPending}
        error={allocateError}
        onConfirm={handleAllocateConfirm}
        onClose={() => {
          setAllocateOpen(false);
          setAllocateError(null);
        }}
      />

      <DeallocatePaymentDialog
        open={deallocateTarget !== null}
        payment={payment}
        allocation={deallocateTarget}
        submitting={deallocateMutation.isPending}
        error={deallocateError}
        onConfirm={handleDeallocateConfirm}
        onClose={() => {
          setDeallocateTarget(null);
          setDeallocateError(null);
        }}
      />

      <DeletePaymentDialog
        open={deleteOpen}
        payment={payment}
        submitting={deleteMutation.isPending}
        error={deleteError}
        onConfirm={handleDeleteConfirm}
        onClose={() => {
          setDeleteOpen(false);
          setDeleteError(null);
        }}
      />

      {toast && (
        <ToastContainer toasts={[toast]} position="top-right" onDismiss={() => setToast(null)} />
      )}
    </div>
  );
};
