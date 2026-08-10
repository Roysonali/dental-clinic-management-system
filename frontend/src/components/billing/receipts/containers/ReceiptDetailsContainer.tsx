import { useState, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../../common/Card/Card';
import { Button } from '../../../common/Button/Button';
import { ToastContainer, type Toast } from '../../../common/Toast';
import { StatusBadge } from '../../../common/StatusBadge/StatusBadge';
import { ReceiptOverviewCards } from '../ReceiptOverviewCards';
import { ReceiptFinancialSummaryCard } from '../ReceiptFinancialSummaryCard';
import { LinkedPaymentCard } from '../LinkedPaymentCard';
import { ReceiptAuditTrailCard } from '../ReceiptAuditTrailCard';
import { ReceiptPrintMetadataCard } from '../ReceiptPrintMetadataCard';
import { ReceiptDocumentMetadataCard } from '../ReceiptDocumentMetadataCard';
import { ReceiptDetailActions } from '../ReceiptDetailActions';
import { ReceiptDetailSkeleton } from '../ReceiptDetailSkeleton';
import { ReceiptDetailError } from '../ReceiptDetailError';
import { ReceiptDetailPermission } from '../ReceiptDetailPermission';
import { RegenerateReceiptDialog } from '../dialogs/RegenerateReceiptDialog';
import { RECEIPT_STATUS_VARIANTS } from '../../../../constants/billing';
import { useReceipt } from '../../../../hooks/billing/useReceipt';
import { usePayment } from '../../../../hooks/billing/usePayment';
import { useRegenerateReceipt } from '../../../../hooks/billing/useReceiptMutations';
import { parseApiError } from '../../../../services/apiError';
import { ROUTES } from '../../../../routes/routes';
import type { PaymentStatus } from '../../../../types/billing';

const TOAST_DURATION_MS = 5000;

interface ReceiptDetailsContainerProps {
  receiptId: string;
}

/**
 * ReceiptDetailsContainer — receipt detail orchestration (Sprint 14A.5).
 *
 * Fetches the full aggregate (GET /billing/receipts/{id}) plus the linked
 * payment (GET /billing/payments/{id} — the receipt's own payment summary
 * carries no status, and the reference Linked Payment card shows one).
 *
 * Loading → skeleton layout; 403 → permission state (never retried);
 * error/404 → safe error copy with Retry + Back to payment.
 */
export const ReceiptDetailsContainer: FC<ReceiptDetailsContainerProps> = ({ receiptId }) => {
  const navigate = useNavigate();
  const receiptQuery = useReceipt(receiptId);
  const receipt = receiptQuery.data;

  const [toast, setToast] = useState<Toast | null>(null);
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);

  const regenerateMutation = useRegenerateReceipt();

  // The linked payment status for the Linked Payment card — fetched only
  // once the receipt resolves; failures degrade to a "—" status cell.
  const paymentQuery = usePayment(receipt?.payment.id ?? '', {
    enabled: !!receipt,
  });
  const paymentStatus: PaymentStatus | null = paymentQuery.data?.status ?? null;

  const showToast = (variant: Toast['variant'], title: string, description?: string) => {
    setToast({ id: `rct-${Date.now()}`, variant, title, description });
    window.setTimeout(() => setToast(null), TOAST_DURATION_MS);
  };

  if (receiptQuery.isLoading) {
    return <ReceiptDetailSkeleton />;
  }

  if (receiptQuery.isError) {
    const info = parseApiError(receiptQuery.error);
    if (info.kind === 'forbidden') return <ReceiptDetailPermission />;
    return (
      <ReceiptDetailError
        receiptNumber={null}
        onRetry={() => void receiptQuery.refetch()}
        onBack={() => navigate(ROUTES.BILLING_PAYMENTS)}
      />
    );
  }

  if (!receipt) {
    return (
      <ReceiptDetailError
        receiptNumber={null}
        onRetry={() => void receiptQuery.refetch()}
        onBack={() => navigate(ROUTES.BILLING_PAYMENTS)}
      />
    );
  }

  const backToPayment = () => navigate(`${ROUTES.BILLING_PAYMENTS}/${receipt.payment.id}`);

  const handleRegenerateConfirm = () => {
    setRegenerateError(null);
    regenerateMutation.mutate(receipt.id, {
      onSuccess: (regenerated) => {
        setRegenerateOpen(false);
        showToast('success', `${regenerated.receipt_number} regenerated`, 'The document was re-produced from the payment record.');
      },
      onError: (error) => setRegenerateError(parseApiError(error).message),
    });
  };

  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      {/* Header */}
      <Card>
        <Card.Body>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="ghost" size="sm" onClick={backToPayment}>
                  ← Payment {receipt.payment.payment_number}
                </Button>
                <h1 className="text-h2 font-semibold tracking-tight text-neutral-900">
                  {receipt.receipt_number}
                </h1>
                <StatusBadge status={receipt.status} statusMap={RECEIPT_STATUS_VARIANTS} />
              </div>
              <p className="mt-2 text-body-sm text-neutral-500">
                {receipt.patient.full_name} · {receipt.patient.patient_code}
              </p>
            </div>
            <ReceiptDetailActions
              status={receipt.status}
              submitting={regenerateMutation.isPending}
              onRegenerate={() => {
                setRegenerateError(null);
                setRegenerateOpen(true);
              }}
            />
          </div>
        </Card.Body>
      </Card>

      {/* Top information cards + financial summary */}
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:col-span-3 xl:grid-cols-3">
          <ReceiptOverviewCards receipt={receipt} />
        </div>
        <ReceiptFinancialSummaryCard receipt={receipt} />
      </div>

      {/* Main column (linked payment + audit trail) + right metadata column */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <LinkedPaymentCard receipt={receipt} paymentStatus={paymentStatus} />
          <ReceiptAuditTrailCard receipt={receipt} />
        </div>
        <div className="flex flex-col gap-6">
          <ReceiptPrintMetadataCard receipt={receipt} />
          <ReceiptDocumentMetadataCard receipt={receipt} />
        </div>
      </div>

      {/* ── Dialogs ─────────────────────────────────────────────── */}
      <RegenerateReceiptDialog
        open={regenerateOpen}
        receipt={receipt}
        submitting={regenerateMutation.isPending}
        error={regenerateError}
        onConfirm={handleRegenerateConfirm}
        onClose={() => {
          setRegenerateOpen(false);
          setRegenerateError(null);
        }}
      />

      {toast && (
        <ToastContainer toasts={[toast]} position="top-right" onDismiss={() => setToast(null)} />
      )}
    </div>
  );
};
