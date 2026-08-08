import { useEffect, useState, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { PaymentToolbar } from '../PaymentToolbar';
import { PaymentTable } from '../PaymentTable';
import { PaymentListPermission } from '../PaymentListPermission';
import { RecordPaymentDrawer } from '../dialogs/RecordPaymentDrawer';
import { CompletePaymentDialog } from '../dialogs/CompletePaymentDialog';
import { FailPaymentDialog } from '../dialogs/FailPaymentDialog';
import { VoidPaymentDialog } from '../dialogs/VoidPaymentDialog';
import { AllocatePaymentDialog } from '../dialogs/AllocatePaymentDialog';
import { DeletePaymentDialog } from '../dialogs/DeletePaymentDialog';
import { Pagination } from '../../../common/Pagination/Pagination';
import { ToastContainer, type Toast } from '../../../common/Toast';
import { PAYMENT_PAGE_SIZE_OPTIONS } from '../../../../constants/billing';
import { usePayments } from '../../../../hooks/billing/usePayments';
import { usePaymentFilters } from '../../../../hooks/billing/usePaymentFilters';
import {
  useCreatePayment,
  useCompletePayment,
  useFailPayment,
  useVoidPayment,
  useAllocatePayment,
  useDeletePayment,
} from '../../../../hooks/billing/usePaymentMutations';
import { parseApiError } from '../../../../services/apiError';
import { ROUTES } from '../../../../routes/routes';
import { paymentFormValuesToCreatePayload } from '../../../../utils/paymentFormUtils';
import type { SortState } from '../../../common/DataTable';
import type { PaymentFormValues } from '../../../../utils/paymentFormSchema';
import type { PaymentListItem, PaymentSortField } from '../../../../types/billing';

/** Toast lifetime before auto-dismiss (ms). */
const TOAST_DURATION_MS = 5000;

interface PaymentListContainerProps {
  /** Controlled open state for the Record Payment drawer (owned by the page). */
  createOpen?: boolean;
  /** Called when the create drawer should close. */
  onCreateClose?: () => void;
  /** Called when a create request originates inside the container (empty-state CTA). */
  onRequestCreate?: () => void;
}

/**
 * PaymentListContainer — payment list orchestration (Sprint 14A.3).
 *
 * Owns the server-side filter state, the list query, the Record Payment
 * drawer (open state is controlled by the page so the header CTA and the
 * drawer stay in sync) and the lifecycle/allocation/delete dialogs. All
 * filters are backend-driven (GET /billing/payments), so ACTIVE FILTERS =
 * VISIBLE DATA.
 *
 * States:
 * - Loading → skeleton rows (DataTable `loading`), toolbar stays put.
 * - 403     → permission-denied state (never auto-retried).
 * - Error   → DataTable error panel with Retry (refetch, no reload).
 * - Empty   → "No payments yet" (+ Record payment) when unfiltered, else
 *             "No payments match these filters" (+ Clear filters).
 *
 * Row actions are state-machine driven (getPaymentActions) and Delete is
 * admin-gated via PermissionGate in the table.
 */
export const PaymentListContainer: FC<PaymentListContainerProps> = ({
  createOpen = false,
  onCreateClose = () => undefined,
  onRequestCreate = () => undefined,
}) => {
  const navigate = useNavigate();
  const filters = usePaymentFilters();

  const [toast, setToast] = useState<Toast | null>(null);

  /* ── Query state ─────────────────────────────────────────────── */
  const paymentsQuery = usePayments(filters.params);

  /* ── Dialog state ────────────────────────────────────────────── */
  const [createError, setCreateError] = useState<string | null>(null);
  const [createFieldErrors, setCreateFieldErrors] = useState<Record<string, string>>({});

  const [completeTarget, setCompleteTarget] = useState<PaymentListItem | null>(null);
  const [completeError, setCompleteError] = useState<string | null>(null);

  const [failTarget, setFailTarget] = useState<PaymentListItem | null>(null);
  const [failError, setFailError] = useState<string | null>(null);

  const [voidTarget, setVoidTarget] = useState<PaymentListItem | null>(null);
  const [voidError, setVoidError] = useState<string | null>(null);

  const [allocateTarget, setAllocateTarget] = useState<PaymentListItem | null>(null);
  const [allocateError, setAllocateError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<PaymentListItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  /* ── Mutations ───────────────────────────────────────────────── */
  const createMutation = useCreatePayment();
  const completeMutation = useCompletePayment();
  const failMutation = useFailPayment();
  const voidMutation = useVoidPayment();
  const allocateMutation = useAllocatePayment();
  const deleteMutation = useDeletePayment();

  // Auto-dismiss the transient toast.
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const showToast = (variant: Toast['variant'], title: string, description?: string) => {
    setToast({ id: `pay-${Date.now()}`, variant, title, description });
  };

  /* ── 403 → permission state (never auto-retried) ─────────────── */
  if (paymentsQuery.isError) {
    const info = parseApiError(paymentsQuery.error);
    if (info.kind === 'forbidden') {
      return <PaymentListPermission />;
    }
  }

  const queryError = paymentsQuery.error ? parseApiError(paymentsQuery.error).message : null;
  const items = paymentsQuery.data?.items ?? [];
  const total = paymentsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));

  const sortState: SortState = { key: filters.sortBy, direction: filters.sortOrder };

  const handleSortChange = (next: SortState | null) => {
    if (!next) {
      // Backend always sorts; a cleared sort falls back to the default.
      filters.setSortBy('created_at');
      filters.setSortOrder('desc');
      return;
    }
    filters.setSortBy(next.key as PaymentSortField);
    filters.setSortOrder(next.direction);
  };

  /* ── Handlers ────────────────────────────────────────────────── */

  const handleCreate = (values: PaymentFormValues) => {
    setCreateError(null);
    setCreateFieldErrors({});
    createMutation.mutate(paymentFormValuesToCreatePayload(values), {
      onSuccess: (payment) => {
        onCreateClose();
        showToast('success', `${payment.payment_number} saved`, 'Saved as pending — complete it before allocating.');
        navigate(`${ROUTES.BILLING_PAYMENTS}/${payment.id}`);
      },
      onError: (error) => {
        const info = parseApiError(error);
        if (info.kind === 'validation' && Object.keys(info.fieldErrors).length > 0) {
          setCreateFieldErrors(info.fieldErrors);
        } else {
          setCreateError(info.message);
        }
      },
    });
  };

  const handleCompleteConfirm = () => {
    if (!completeTarget) return;
    setCompleteError(null);
    completeMutation.mutate(completeTarget.id, {
      onSuccess: (payment) => {
        setCompleteTarget(null);
        showToast('success', `${payment.payment_number} completed`, 'It can now be allocated to invoices.');
      },
      onError: (error) => setCompleteError(parseApiError(error).message),
    });
  };

  const handleFailConfirm = (reason: string) => {
    if (!failTarget) return;
    setFailError(null);
    failMutation.mutate(
      { id: failTarget.id, payload: reason ? { reason } : {} },
      {
        onSuccess: (payment) => {
          setFailTarget(null);
          showToast('success', `${payment.payment_number} marked as failed`);
        },
        onError: (error) => setFailError(parseApiError(error).message),
      },
    );
  };

  const handleVoidConfirm = (reason: string) => {
    if (!voidTarget) return;
    setVoidError(null);
    voidMutation.mutate(
      { id: voidTarget.id, payload: reason ? { reason } : {} },
      {
        onSuccess: (payment) => {
          setVoidTarget(null);
          showToast('success', `${payment.payment_number} voided`);
        },
        onError: (error) => setVoidError(parseApiError(error).message),
      },
    );
  };

  const handleAllocateConfirm = (invoiceId: string, amount: string) => {
    if (!allocateTarget) return;
    setAllocateError(null);
    allocateMutation.mutate(
      { id: allocateTarget.id, payload: { invoice_id: invoiceId, amount } },
      {
        onSuccess: () => {
          setAllocateTarget(null);
          showToast('success', 'Allocation recorded', 'The payment has been applied to the invoice.');
        },
        onError: (error) => setAllocateError(parseApiError(error).message),
      },
    );
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    setDeleteError(null);
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        setDeleteTarget(null);
        showToast('success', 'Payment deleted', 'The pending payment was permanently removed.');
      },
      onError: (error) => setDeleteError(parseApiError(error).message),
    });
  };

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <PaymentToolbar
        patientId={filters.patientId}
        onPatientChange={filters.setPatientId}
        method={filters.method}
        onMethodChange={filters.setMethod}
        status={filters.status}
        onStatusChange={filters.setStatus}
        dateFrom={filters.dateFrom}
        onDateFromChange={filters.setDateFrom}
        dateTo={filters.dateTo}
        onDateToChange={filters.setDateTo}
        sortBy={filters.sortBy}
        onSortByChange={filters.setSortBy}
        sortOrder={filters.sortOrder}
        onSortOrderChange={filters.setSortOrder}
        hasActiveFilters={filters.hasActiveFilters}
        onClearFilters={filters.clearFilters}
      />

      <PaymentTable
        payments={items}
        loading={paymentsQuery.isLoading}
        error={queryError}
        onRetry={() => void paymentsQuery.refetch()}
        sortState={sortState}
        onSortChange={handleSortChange}
        onView={(pay) => navigate(`${ROUTES.BILLING_PAYMENTS}/${pay.id}`)}
        onRowClick={(pay) => navigate(`${ROUTES.BILLING_PAYMENTS}/${pay.id}`)}
        onComplete={(pay) => {
          setCompleteError(null);
          setCompleteTarget(pay);
        }}
        onFail={(pay) => {
          setFailError(null);
          setFailTarget(pay);
        }}
        onVoid={(pay) => {
          setVoidError(null);
          setVoidTarget(pay);
        }}
        onAllocate={(pay) => {
          setAllocateError(null);
          setAllocateTarget(pay);
        }}
        onDelete={(pay) => {
          setDeleteError(null);
          setDeleteTarget(pay);
        }}
        onCreate={() => {
          setCreateError(null);
          setCreateFieldErrors({});
          onRequestCreate();
        }}
        onClearFilters={filters.clearFilters}
        hasActiveFilters={filters.hasActiveFilters}
      />

      <Pagination
        currentPage={filters.page}
        totalPages={totalPages}
        onPageChange={filters.setPage}
        totalCount={total}
        pageSize={filters.pageSize}
        pageSizeSelector={
          <select
            value={filters.pageSize}
            onChange={(e) => filters.setPageSize(Number(e.target.value))}
            aria-label="Rows per page"
            className="h-8 rounded-lg border border-neutral-300 bg-white px-2 text-caption text-neutral-700 transition-colors duration-150 hover:border-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          >
            {PAYMENT_PAGE_SIZE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        }
      />

      <RecordPaymentDrawer
        open={createOpen}
        onClose={() => {
          onCreateClose();
          setCreateError(null);
          setCreateFieldErrors({});
        }}
        onSubmit={handleCreate}
        submitting={createMutation.isPending}
        serverErrors={createFieldErrors}
        serverMessage={createError}
      />

      <CompletePaymentDialog
        open={completeTarget !== null}
        payment={completeTarget}
        submitting={completeMutation.isPending}
        error={completeError}
        onConfirm={handleCompleteConfirm}
        onClose={() => {
          setCompleteTarget(null);
          setCompleteError(null);
        }}
      />

      <FailPaymentDialog
        open={failTarget !== null}
        payment={failTarget}
        submitting={failMutation.isPending}
        error={failError}
        onConfirm={handleFailConfirm}
        onClose={() => {
          setFailTarget(null);
          setFailError(null);
        }}
      />

      <VoidPaymentDialog
        open={voidTarget !== null}
        payment={voidTarget}
        submitting={voidMutation.isPending}
        error={voidError}
        onConfirm={handleVoidConfirm}
        onClose={() => {
          setVoidTarget(null);
          setVoidError(null);
        }}
      />

      <AllocatePaymentDialog
        open={allocateTarget !== null}
        payment={allocateTarget}
        submitting={allocateMutation.isPending}
        error={allocateError}
        onConfirm={handleAllocateConfirm}
        onClose={() => {
          setAllocateTarget(null);
          setAllocateError(null);
        }}
      />

      <DeletePaymentDialog
        open={deleteTarget !== null}
        payment={deleteTarget}
        submitting={deleteMutation.isPending}
        error={deleteError}
        onConfirm={handleDeleteConfirm}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
      />

      {toast && (
        <ToastContainer toasts={[toast]} position="top-right" onDismiss={() => setToast(null)} />
      )}
    </div>
  );
};
