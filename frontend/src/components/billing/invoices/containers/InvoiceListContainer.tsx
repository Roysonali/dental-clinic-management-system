import { useEffect, useMemo, useState, type FC } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { InvoiceToolbar } from '../InvoiceToolbar';
import { InvoiceTable } from '../InvoiceTable';
import { InvoiceListPermission } from '../InvoiceListPermission';
import { CreateInvoiceDrawer } from '../dialogs/CreateInvoiceDrawer';
import { EditInvoiceDrawer } from '../dialogs/EditInvoiceDrawer';
import { IssueInvoiceDialog } from '../dialogs/IssueInvoiceDialog';
import { CancelInvoiceDialog } from '../dialogs/CancelInvoiceDialog';
import { DeleteInvoiceDialog } from '../dialogs/DeleteInvoiceDialog';
import { Pagination } from '../../../common/Pagination/Pagination';
import { ToastContainer, type Toast } from '../../../common/Toast';
import { INVOICE_PAGE_SIZE_OPTIONS } from '../../../../constants/billing';
import { useInvoices } from '../../../../hooks/billing/useInvoices';
import { useInvoiceFilters } from '../../../../hooks/billing/useInvoiceFilters';
import { useInvoice } from '../../../../hooks/billing/useInvoice';
import {
  useCreateInvoice,
  useUpdateDraftInvoice,
  useIssueInvoice,
  useCancelInvoice,
  useDeleteInvoice,
} from '../../../../hooks/billing/useInvoiceMutations';
import { useDoctors } from '../../../../hooks/doctors/useDoctors';
import { parseApiError } from '../../../../services/apiError';
import { ROUTES, INVOICE_CREATE_QUERY_PARAM } from '../../../../routes/routes';
import { invoiceFormValuesToCreatePayload, editFormValuesToUpdatePayload } from '../../../../utils/invoiceFormUtils';
import type { SortState } from '../../../common/DataTable';
import type { InvoiceEditFormValues, InvoiceCreateFormValues } from '../../../../utils/invoiceFormSchema';
import type { InvoiceListItem, InvoiceSortField } from '../../../../types/billing';

/** Toast lifetime before auto-dismiss (ms). */
const TOAST_DURATION_MS = 5000;

/**
 * InvoiceListContainer — invoice list orchestration (Sprint 14A.2).
 *
 * Owns the server-side filter state, the list + doctor queries, the
 * create/edit drawers and the issue/cancel/delete dialogs. All filters are
 * backend-driven (GET /billing/invoices), so ACTIVE FILTERS = VISIBLE DATA.
 *
 * States:
 * - Loading → skeleton rows (DataTable `loading`), toolbar stays put.
 * - 403     → permission-denied state (never auto-retried).
 * - Error   → DataTable error panel with Retry (refetch, no reload).
 * - Empty   → "No invoices yet" (+ New invoice) when unfiltered, else
 *             "No invoices match these filters" (+ Clear filters).
 *
 * Row actions are state-machine driven (getInvoiceActions) and Delete is
 * admin-gated via PermissionGate in the table.
 *
 * Create-intent handoff (Sprint 14A.2.x): the Billing Dashboard's "New
 * invoice" CTA navigates here with `?create=true`. The intent is derived
 * directly from the URL (drawer opens on the first render — no flash) and
 * stripped again the moment the drawer closes, so closing always leaves a
 * clean `/billing/invoices` URL and browser Back/Forward can never re-open
 * the drawer unexpectedly.
 */
export const InvoiceListContainer: FC = () => {
  const navigate = useNavigate();
  const filters = useInvoiceFilters();
  const [searchParams, setSearchParams] = useSearchParams();

  const [toast, setToast] = useState<Toast | null>(null);

  /* ── Query state ─────────────────────────────────────────────── */
  const invoicesQuery = useInvoices(filters.params);
  const doctorsQuery = useDoctors(); // active doctors, 5-min cache (dropdown)

  /* ── Dialog state ────────────────────────────────────────────── */
  // The create drawer is derived from BOTH the local toolbar/table CTA and
  // the URL create intent (`/billing/invoices?create=true` from the
  // dashboard). Deriving keeps setState out of effects and opens the drawer
  // on the first render when the intent is present.
  const createRequested = searchParams.get(INVOICE_CREATE_QUERY_PARAM) === 'true';
  const [createOpenLocal, setCreateOpenLocal] = useState(false);
  const createOpen = createRequested || createOpenLocal;
  const [createError, setCreateError] = useState<string | null>(null);
  const [createFieldErrors, setCreateFieldErrors] = useState<Record<string, string>>({});

  const [issueTarget, setIssueTarget] = useState<InvoiceListItem | null>(null);
  const [issueError, setIssueError] = useState<string | null>(null);

  const [editTarget, setEditTarget] = useState<InvoiceListItem | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editFieldErrors, setEditFieldErrors] = useState<Record<string, string>>({});

  const [cancelTarget, setCancelTarget] = useState<InvoiceListItem | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<InvoiceListItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  /* ── Mutations ───────────────────────────────────────────────── */
  const createMutation = useCreateInvoice();
  const issueMutation = useIssueInvoice();
  const editMutation = useUpdateDraftInvoice();
  const cancelMutation = useCancelInvoice();
  const deleteMutation = useDeleteInvoice();

  // Edit prefill: list rows carry summaries only (no notes), so the full
  // aggregate is fetched lazily only when the Edit action is opened.
  const editQuery = useInvoice(editTarget?.id ?? '', { enabled: editTarget !== null });
  const editInvoice = editQuery.data ?? null;

  // Auto-dismiss the transient toast.
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  // All hooks must run before any early return (rules-of-hooks).
  const doctorOptions = useMemo(
    () =>
      (doctorsQuery.data?.items ?? []).map((d) => ({
        value: d.id,
        label: d.user_full_name ?? `Doctor #${d.id}`,
      })),
    [doctorsQuery.data?.items],
  );

  const showToast = (variant: Toast['variant'], title: string, description?: string) => {
    setToast({ id: `inv-${Date.now()}`, variant, title, description });
  };

  /* ── 403 → permission state (never auto-retried) ─────────────── */
  if (invoicesQuery.isError) {
    const info = parseApiError(invoicesQuery.error);
    if (info.kind === 'forbidden') {
      return <InvoiceListPermission />;
    }
  }

  const queryError = invoicesQuery.error ? parseApiError(invoicesQuery.error).message : null;
  const items = invoicesQuery.data?.items ?? [];
  const total = invoicesQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));

  const sortState: SortState = { key: filters.sortBy, direction: filters.sortOrder };

  const handleSortChange = (next: SortState | null) => {
    if (!next) {
      // Backend always sorts; a cleared sort falls back to the default.
      filters.setSortBy('created_at');
      filters.setSortOrder('desc');
      return;
    }
    // Only whitelisted columns are sortable (backend InvoiceRepository
    // `_ALLOWED_SORT_FIELDS`) — do NOT add sortable columns without also
    // adding them to the backend whitelist, or the backend silently falls
    // back to the default sort (created_at).
    filters.setSortBy(next.key as InvoiceSortField);
    filters.setSortOrder(next.direction);
  };

  /* ── Handlers ────────────────────────────────────────────────── */

  /**
   * Remove the URL create intent (`?create=true`) with `replace` so the
   * history entry becomes a clean `/billing/invoices` — Back/Forward can
   * never land on a stale intent and re-open the drawer.
   */
  const clearCreateIntent = () => {
    if (!createRequested) return;
    const next = new URLSearchParams(searchParams);
    next.delete(INVOICE_CREATE_QUERY_PARAM);
    setSearchParams(next, { replace: true });
  };

  const openCreateDrawer = () => {
    setCreateError(null);
    setCreateFieldErrors({});
    setCreateOpenLocal(true);
  };

  const closeCreateDrawer = () => {
    setCreateOpenLocal(false);
    setCreateError(null);
    setCreateFieldErrors({});
    clearCreateIntent();
  };

  const handleCreate = (values: InvoiceCreateFormValues) => {
    setCreateError(null);
    setCreateFieldErrors({});
    createMutation.mutate(invoiceFormValuesToCreatePayload(values), {
      onSuccess: (invoice) => {
        setCreateOpenLocal(false);
        // Strip the intent BEFORE navigating so a later Back from the new
        // invoice's detail page returns to a clean list (no drawer re-open).
        clearCreateIntent();
        showToast('success', `${invoice.invoice_number} saved as draft`);
        navigate(`${ROUTES.BILLING_INVOICES}/${invoice.id}`);
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

  const handleIssueConfirm = () => {
    if (!issueTarget) return;
    setIssueError(null);
    issueMutation.mutate(issueTarget.id, {
      onSuccess: (invoice) => {
        setIssueTarget(null);
        showToast('success', `${invoice.invoice_number} issued`, 'A permanent number has been assigned.');
      },
      onError: (error) => setIssueError(parseApiError(error).message),
    });
  };

  const handleEditSubmit = (values: InvoiceEditFormValues) => {
    if (!editTarget) return;
    setEditError(null);
    setEditFieldErrors({});
    editMutation.mutate(
      { id: editTarget.id, payload: editFormValuesToUpdatePayload(values) },
      {
        onSuccess: (invoice) => {
          setEditTarget(null);
          showToast('success', `${invoice.invoice_number} updated`);
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

  const handleCancelConfirm = (reason: string) => {
    if (!cancelTarget) return;
    setCancelError(null);
    cancelMutation.mutate(
      { id: cancelTarget.id, payload: { cancellation_reason: reason } },
      {
        onSuccess: (invoice) => {
          setCancelTarget(null);
          showToast('success', `${invoice.invoice_number} cancelled`);
        },
        onError: (error) => setCancelError(parseApiError(error).message),
      },
    );
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    setDeleteError(null);
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        setDeleteTarget(null);
        showToast('success', 'Draft deleted', 'The draft invoice was permanently removed.');
      },
      onError: (error) => setDeleteError(parseApiError(error).message),
    });
  };

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <InvoiceToolbar
        searchValue={filters.searchInput}
        onSearchChange={filters.setSearchInput}
        searchLoading={invoicesQuery.isFetching && !invoicesQuery.isPlaceholderData}
        status={filters.status}
        onStatusChange={filters.setStatus}
        patientId={filters.patientId}
        onPatientChange={filters.setPatientId}
        doctorId={filters.doctorId}
        onDoctorChange={filters.setDoctorId}
        doctorOptions={doctorOptions}
        doctorsLoading={doctorsQuery.isLoading}
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
        onCreate={openCreateDrawer}
      />

      <InvoiceTable
        invoices={items}
        loading={invoicesQuery.isLoading}
        error={queryError}
        onRetry={() => void invoicesQuery.refetch()}
        sortState={sortState}
        onSortChange={handleSortChange}
        onView={(inv) => navigate(`${ROUTES.BILLING_INVOICES}/${inv.id}`)}
        onRowClick={(inv) => navigate(`${ROUTES.BILLING_INVOICES}/${inv.id}`)}
        onIssue={(inv) => {
          setIssueError(null);
          setIssueTarget(inv);
        }}
        onEdit={(inv) => {
          setEditError(null);
          setEditFieldErrors({});
          setEditTarget(inv);
        }}
        onCancel={(inv) => {
          setCancelError(null);
          setCancelTarget(inv);
        }}
        onDelete={(inv) => {
          setDeleteError(null);
          setDeleteTarget(inv);
        }}
        onCreate={openCreateDrawer}
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
            {INVOICE_PAGE_SIZE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        }
      />

      <CreateInvoiceDrawer
        open={createOpen}
        onClose={closeCreateDrawer}
        onSubmit={handleCreate}
        submitting={createMutation.isPending}
        serverErrors={createFieldErrors}
        serverMessage={createError}
      />

      <EditInvoiceDrawer
        key={editTarget?.id ?? 'closed'}
        open={editTarget !== null}
        invoice={editInvoice}
        loading={editQuery.isPending && editTarget !== null}
        onClose={() => {
          setEditTarget(null);
          setEditError(null);
          setEditFieldErrors({});
        }}
        onSubmit={handleEditSubmit}
        submitting={editMutation.isPending}
        serverErrors={editFieldErrors}
        serverMessage={editError}
      />

      <IssueInvoiceDialog
        open={issueTarget !== null}
        invoice={issueTarget}
        submitting={issueMutation.isPending}
        error={issueError}
        onConfirm={handleIssueConfirm}
        onClose={() => {
          setIssueTarget(null);
          setIssueError(null);
        }}
      />

      <CancelInvoiceDialog
        open={cancelTarget !== null}
        invoice={cancelTarget}
        submitting={cancelMutation.isPending}
        error={cancelError}
        onConfirm={handleCancelConfirm}
        onClose={() => {
          setCancelTarget(null);
          setCancelError(null);
        }}
      />

      <DeleteInvoiceDialog
        open={deleteTarget !== null}
        invoice={deleteTarget}
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
