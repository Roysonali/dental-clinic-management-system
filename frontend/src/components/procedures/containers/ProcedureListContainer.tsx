import { useEffect, useMemo, useState, type FC } from 'react';
import { ProcedureTable } from '../ProcedureTable';
import { ProcedureFormDialog } from '../ProcedureFormDialog';
import { DeleteProcedureDialog, type ProcedureStatusIntent } from '../DeleteProcedureDialog';
import { Pagination } from '../../common/Pagination/Pagination';
import { ToastContainer, type Toast } from '../../common/Toast';
import { useProcedures } from '../../../hooks/procedures/useProcedures';
import { useProcedureSearch } from '../../../hooks/procedures/useProcedureSearch';
import { useProcedure } from '../../../hooks/procedures/useProcedure';
import { useCreateProcedure, useUpdateProcedure, useActivateProcedure, useDeactivateProcedure, useDeleteProcedure } from '../../../hooks/procedures/useProcedureMutations';
import { useDebounce } from '../../../hooks/useDebounce';
import { procedureFormValuesToCreate, procedureFormValuesToUpdate } from '../procedureFormUtils';
import { PROCEDURE_PAGE_SIZE_OPTIONS } from '../../../constants/procedure';
import { parseApiError } from '../../../services/apiError';
import type { ProcedureCategory, ProcedureFormValues, ProcedureListParams, ProcedureResponse } from '../../../types/procedure';

/** Toast lifetime before auto-dismiss (ms). */
const TOAST_DURATION_MS = 5000;

/**
 * ProcedureListContainer — S-07 orchestration ([MAP §3.7]).
 *
 * Reads are 🅰 (route not role-gated); every write trigger (New/Edit/
 * Activate/Deactivate/Delete) is wrapped in `PermissionGate` (⭐ =
 * ADMIN + CHIEF_DOCTOR) — backend-first RBAC. The active toggle is a
 * separate activate/deactivate PATCH (not part of the form payload).
 */
export const ProcedureListContainer: FC = () => {
  const [searchInput, setSearchInput] = useState('');
  const [category, setCategory] = useState<ProcedureCategory | 'all'>('all');
  const [isActive, setIsActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const debouncedSearch = useDebounce(searchInput, 350);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formFieldErrors, setFormFieldErrors] = useState<Record<string, string>>({});

  const [statusState, setStatusState] = useState<{ procedure: ProcedureResponse; intent: ProcedureStatusIntent } | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [toast, setToast] = useState<Toast | null>(null);

  const params = useMemo<ProcedureListParams>(
    () => ({
      page,
      page_size: pageSize,
      ...(category !== 'all' ? { category } : {}),
      ...(isActive !== 'all' ? { is_active: isActive === 'active' } : {}),
    }),
    [page, pageSize, category, isActive],
  );

  const proceduresQuery = useProcedures(params);
  // GET /procedures has NO search param — search lives on /procedures/search.
  // When a term is active, the type-ahead results replace the paged list so
  // matches are found across ALL pages (architecture §11).
  const searchQuery = useProcedureSearch(debouncedSearch);
  const editingQuery = useProcedure(editingId, formMode === 'edit' && editingId !== null);

  const createMutation = useCreateProcedure();
  const updateMutation = useUpdateProcedure();
  const activateMutation = useActivateProcedure();
  const deactivateMutation = useDeactivateProcedure();
  const deleteMutation = useDeleteProcedure();

  const statusSubmitting =
    activateMutation.isPending || deactivateMutation.isPending || deleteMutation.isPending;

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleSubmit = (values: ProcedureFormValues) => {
    setFormError(null);
    setFormFieldErrors({});
    const options = {
      onSuccess: () => {
        setFormOpen(false);
        setEditingId(null);
        setToast({
          id: `proc-${Date.now()}`,
          variant: 'success',
          title: formMode === 'edit' ? 'Procedure updated' : 'Procedure created',
        });
      },
      onError: (error: Error) => {
        const info = parseApiError(error);
        if (info.kind === 'validation' && Object.keys(info.fieldErrors).length > 0) {
          setFormFieldErrors(info.fieldErrors);
        } else {
          setFormError(info.message);
        }
      },
    };
    if (formMode === 'edit' && editingId !== null) {
      updateMutation.mutate({ id: editingId, payload: procedureFormValuesToUpdate(values) }, options);
    } else {
      createMutation.mutate(procedureFormValuesToCreate(values), options);
    }
  };

  const openCreateForm = () => {
    setFormMode('create');
    setEditingId(null);
    setFormError(null);
    setFormFieldErrors({});
    setFormOpen(true);
  };

  const handleStatusConfirm = () => {
    if (!statusState) return;
    setStatusError(null);
    const { procedure, intent } = statusState;
    const options = {
      onSuccess: () => {
        setStatusState(null);
        setToast({
          id: `proc-${Date.now()}`,
          variant: 'success',
          title: intent === 'delete' ? 'Procedure deleted' : intent === 'activate' ? 'Procedure activated' : 'Procedure deactivated',
        });
      },
      onError: (error: Error) => setStatusError(parseApiError(error).message),
    };
    if (intent === 'delete') deleteMutation.mutate(procedure.id, options);
    else if (intent === 'activate') activateMutation.mutate(procedure.id, options);
    else deactivateMutation.mutate(procedure.id, options);
  };

  const isSearching = debouncedSearch.trim().length > 0;
  const visibleRows = isSearching ? (searchQuery.data ?? []) : (proceduresQuery.data?.items ?? []);
  const rowsLoading = isSearching ? searchQuery.isPending : proceduresQuery.isLoading;

  const totalPages = Math.max(1, proceduresQuery.data?.total_pages ?? 1);
  const queryError = proceduresQuery.error ? parseApiError(proceduresQuery.error).message : null;

  return (
    <div className="flex w-full flex-col gap-4">
      <ProcedureTable
        procedures={visibleRows}
        loading={rowsLoading}
        error={queryError}
        onRetry={() => void (isSearching ? searchQuery.refetch() : proceduresQuery.refetch())}
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchLoading={isSearching ? searchQuery.isFetching : proceduresQuery.isFetching && !proceduresQuery.isPlaceholderData}
        category={category}
        onCategoryChange={(next) => {
          setCategory(next);
          setPage(1);
        }}
        status={isActive}
        onStatusChange={(next) => {
          setIsActive(next);
          setPage(1);
        }}
        onCreate={openCreateForm}
        onEdit={(procedure) => {
          setFormMode('edit');
          setEditingId(procedure.id);
          setFormError(null);
          setFormFieldErrors({});
          setFormOpen(true);
        }}
        onToggleActive={(procedure) => {
          setStatusError(null);
          setStatusState({ procedure, intent: procedure.is_active ? 'deactivate' : 'activate' });
        }}
        onDelete={(procedure) => {
          setStatusError(null);
          setStatusState({ procedure, intent: 'delete' });
        }}
      />

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        totalCount={proceduresQuery.data?.total}
        pageSize={pageSize}
        pageSizeSelector={
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            aria-label="Rows per page"
            className="h-8 rounded-lg border border-neutral-300 bg-white px-2 text-caption text-neutral-700 transition-colors duration-150 hover:border-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          >
            {PROCEDURE_PAGE_SIZE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        }
      />

      <ProcedureFormDialog
        key={formMode === 'edit' ? editingId : 'create'}
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingId(null);
          setFormError(null);
          setFormFieldErrors({});
        }}
        mode={formMode}
        loading={formMode === 'edit' && editingQuery.isLoading}
        editCode={editingQuery.data?.code ?? null}
        onSubmit={handleSubmit}
        submitting={createMutation.isPending || updateMutation.isPending}
        serverErrors={formFieldErrors}
        serverMessage={formError}
      />

      <DeleteProcedureDialog
        open={statusState !== null}
        procedure={statusState?.procedure ?? null}
        intent={statusState?.intent ?? null}
        submitting={statusSubmitting}
        error={statusError}
        onConfirm={handleStatusConfirm}
        onClose={() => {
          setStatusState(null);
          setStatusError(null);
        }}
      />

      {toast && (
        <ToastContainer toasts={[toast]} position="top-right" onDismiss={() => setToast(null)} />
      )}
    </div>
  );
};
