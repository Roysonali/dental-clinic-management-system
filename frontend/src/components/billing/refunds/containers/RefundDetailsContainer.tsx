import { useEffect, useState, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../../common/Card/Card';
import { Button } from '../../../common/Button/Button';
import { ToastContainer, type Toast } from '../../../common/Toast';
import { StatusBadge } from '../../../common/StatusBadge/StatusBadge';
import { RefundTimelineCard } from '../RefundTimelineCard';
import { RefundSummaryCard } from '../RefundSummaryCard';
import { RefundReasonCard } from '../RefundReasonCard';
import { RefundDetailActions } from '../RefundDetailActions';
import { RefundDetailSkeleton } from '../RefundDetailSkeleton';
import { RefundDetailEmpty } from '../RefundDetailEmpty';
import { ApproveRefundDialog } from '../dialogs/ApproveRefundDialog';
import { RejectRefundDialog } from '../dialogs/RejectRefundDialog';
import { CompleteRefundDialog } from '../dialogs/CompleteRefundDialog';
import { REFUND_STATUS_VARIANTS } from '../../../../constants/billing';
import { useRefund } from '../../../../hooks/billing/useRefund';
import { usePayment } from '../../../../hooks/billing/usePayment';
import {
  useApproveRefund,
  useRejectRefund,
  useCompleteRefund,
} from '../../../../hooks/billing/useRefundMutations';
import { parseApiError } from '../../../../services/apiError';
import { ROUTES } from '../../../../routes/routes';

const TOAST_DURATION_MS = 5000;

interface RefundDetailsContainerProps {
  refundId: string;
}

/**
 * RefundDetailsContainer — refund timeline orchestration (Sprint 14A.5).
 *
 * NOTE: The backend exposes NO GET /billing/refunds/{id} endpoint. Data is
 * supplied exclusively from mutation responses (create/approve/reject/
 * complete) via `queryClient.setQueryData`. This container reads from the
 * TanStack Query cache; if no cached data exists, an empty state is shown.
 *
 * The linked payment is fetched (GET /billing/payments/{id}) so the summary
 * card can show the real "Previously refunded" total (the refund aggregate
 * does not carry it); failures degrade that row to "—".
 *
 * Lifecycle actions are state-machine driven (RefundDetailActions) and
 * role-gated; the backend remains the final authority.
 */
export const RefundDetailsContainer: FC<RefundDetailsContainerProps> = ({ refundId }) => {
  const navigate = useNavigate();
  const refundQuery = useRefund(refundId);
  const refund = refundQuery.data;

  const [toast, setToast] = useState<Toast | null>(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  const approveMutation = useApproveRefund();
  const rejectMutation = useRejectRefund();
  const completeMutation = useCompleteRefund();

  // Linked payment for the summary card's "Previously refunded" row.
  const paymentQuery = usePayment(refund?.payment.id ?? '', { enabled: !!refund });

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const showToast = (variant: Toast['variant'], title: string, description?: string) => {
    setToast({ id: `rfd-${Date.now()}`, variant, title, description });
  };

  if (refundQuery.isLoading) {
    return <RefundDetailSkeleton />;
  }

  if (!refund) {
    return <RefundDetailEmpty onBack={() => navigate(ROUTES.BILLING_PAYMENTS)} />;
  }

  const backToPayment = () => navigate(`${ROUTES.BILLING_PAYMENTS}/${refund.payment.id}`);

  /* ── Handlers ────────────────────────────────────────────────── */

  const handleApproveConfirm = () => {
    setApproveError(null);
    approveMutation.mutate(refund.id, {
      onSuccess: (approved) => {
        setApproveOpen(false);
        showToast('success', `${approved.refund_number} approved`, 'It still needs to be completed to create the allocation.');
      },
      onError: (error) => setApproveError(parseApiError(error).message),
    });
  };

  const handleRejectConfirm = (reason: string) => {
    setRejectError(null);
    rejectMutation.mutate(
      { id: refund.id, payload: { reason } },
      {
        onSuccess: (rejected) => {
          setRejectOpen(false);
          showToast('success', `${rejected.refund_number} rejected`, 'No money moves and the reason was stored.');
        },
        onError: (error) => setRejectError(parseApiError(error).message),
      },
    );
  };

  const handleCompleteConfirm = () => {
    setCompleteError(null);
    completeMutation.mutate(refund.id, {
      onSuccess: (completed) => {
        setCompleteOpen(false);
        showToast('success', `${completed.refund_number} completed`, 'The refund allocation was created against the payment.');
      },
      onError: (error) => setCompleteError(parseApiError(error).message),
    });
  };

  const actionsSubmitting =
    approveMutation.isPending ||
    rejectMutation.isPending ||
    completeMutation.isPending;

  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      {/* Header */}
      <Card>
        <Card.Body>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="ghost" size="sm" onClick={backToPayment}>
                  ← Payment {refund.payment.payment_number}
                </Button>
                <h1 className="text-h2 font-semibold tracking-tight text-neutral-900">
                  {refund.refund_number}
                </h1>
                <StatusBadge status={refund.status} statusMap={REFUND_STATUS_VARIANTS} />
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-caption font-medium text-neutral-600">
                  v{refund.version}
                </span>
              </div>
              <p className="mt-2 text-body-sm text-neutral-500">
                {refund.patient.full_name}
              </p>
            </div>
            <RefundDetailActions
              status={refund.status}
              submitting={actionsSubmitting}
              onApprove={() => {
                setApproveError(null);
                setApproveOpen(true);
              }}
              onReject={() => {
                setRejectError(null);
                setRejectOpen(true);
              }}
              onComplete={() => {
                setCompleteError(null);
                setCompleteOpen(true);
              }}
            />
          </div>
        </Card.Body>
      </Card>

      {/* Main content grid */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RefundTimelineCard refund={refund} />
        </div>
        <div className="space-y-6">
          <RefundSummaryCard refund={refund} payment={paymentQuery.data ?? null} />
          <RefundReasonCard reason={refund.reason} />
        </div>
      </div>

      {/* ── Dialogs ─────────────────────────────────────────────── */}
      <ApproveRefundDialog
        open={approveOpen}
        refund={refund}
        submitting={approveMutation.isPending}
        error={approveError}
        onConfirm={handleApproveConfirm}
        onClose={() => {
          setApproveOpen(false);
          setApproveError(null);
        }}
      />

      <RejectRefundDialog
        open={rejectOpen}
        refund={refund}
        submitting={rejectMutation.isPending}
        error={rejectError}
        onConfirm={handleRejectConfirm}
        onClose={() => {
          setRejectOpen(false);
          setRejectError(null);
        }}
      />

      <CompleteRefundDialog
        open={completeOpen}
        refund={refund}
        submitting={completeMutation.isPending}
        error={completeError}
        onConfirm={handleCompleteConfirm}
        onClose={() => {
          setCompleteOpen(false);
          setCompleteError(null);
        }}
      />

      {toast && (
        <ToastContainer toasts={[toast]} position="top-right" onDismiss={() => setToast(null)} />
      )}
    </div>
  );
};
