import { useState, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { PatientTable } from '../PatientTable';
import { Pagination } from '../../common/Pagination/Pagination';
import { PatientFormContainer } from './PatientFormContainer';
import { PatientStatusDialog } from '../PatientStatusDialog';
import type { PatientStatusIntent } from '../PatientStatusDialog';
import { MobilePatientList } from '../mobile/MobilePatientList';
import { MobilePageHeader } from '../../../layouts/components/mobile/MobilePageHeader';
import { MobileBottomNav } from '../../../layouts/components/mobile/MobileBottomNav';
import { useIsMobileViewport } from '../../../hooks/useIsMobileViewport';
import { usePatients } from '../../../hooks/patients/usePatients';
import { usePatientFilters } from '../../../hooks/patients/usePatientFilters';
import { useActivatePatient, useDeactivatePatient } from '../../../hooks/patients/usePatientMutations';
import { usePermission } from '../../../hooks/rbac/usePermission';
import { ADMIN_ROLES } from '../../../constants/roles';
import { parseApiError } from '../../../services/apiError';
import type { PatientListItem } from '../../../types/patient';
import type { RowKey } from '../../common/DataTable';

type FormState = { mode: 'create' } | { mode: 'edit'; patient: PatientListItem } | null;
type StatusState = { patient: PatientListItem; intent: PatientStatusIntent } | null;

/**
 * PatientListContainer — orchestrates the patient list page.
 *
 * Owns the query state (search/filter/pagination via usePatientFilters +
 * usePatients), row selection, the create/edit drawer, and the
 * deactivate/reactivate dialogs. Presentational components stay dumb.
 */
export const PatientListContainer: FC = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobileViewport();

  const filters = usePatientFilters();
  const patientsQuery = usePatients(filters.params);

  const [selectedKeys, setSelectedKeys] = useState<RowKey[]>([]);
  const [formState, setFormState] = useState<FormState>(null);
  const [statusState, setStatusState] = useState<StatusState>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const activateMutation = useActivatePatient();
  const deactivateMutation = useDeactivatePatient();
  const statusSubmitting = activateMutation.isPending || deactivateMutation.isPending;

  // Activate/deactivate are ADMIN-only on the backend (require_roles([ADMIN]))
  // — hide the row actions for everyone else (Sprint 11C). Edit/create stay
  // visible: they allow ADMIN + RECEPTIONIST, which the client cannot
  // distinguish, so the backend enforces those.
  const { can } = usePermission();
  const canManageStatus = can(ADMIN_ROLES);

  const queryError = patientsQuery.error ? parseApiError(patientsQuery.error).message : null;

  const totalPages = Math.max(1, Math.ceil((patientsQuery.data?.total ?? 0) / filters.pageSize));

  const hasActiveFilters =
    filters.searchInput.trim() !== '' || filters.status !== 'all';
  const clearFilters = () => {
    filters.setSearchInput('');
    filters.setStatus('all');
    filters.setPage(1);
  };

  const openCreate = () => setFormState({ mode: 'create' });
  const openEdit = (patient: PatientListItem) => setFormState({ mode: 'edit', patient });
  const closeForm = () => setFormState(null);

  const handleStatusConfirm = () => {
    if (!statusState) return;
    setStatusError(null);
    const { patient, intent } = statusState;
    const mutation = intent === 'deactivate' ? deactivateMutation : activateMutation;
    mutation.mutate(patient.id, {
      onSuccess: () => setStatusState(null),
      onError: (error) => setStatusError(parseApiError(error).message),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {isMobile ? (
        <>
          <MobilePageHeader
            title="Patients"
            addLabel="Register patient"
            onAdd={openCreate}
          />
          <MobilePatientList
            patients={patientsQuery.data?.items ?? []}
            loading={patientsQuery.isLoading}
            error={queryError}
            onRetry={() => void patientsQuery.refetch()}
            searchValue={filters.searchInput}
            onSearchChange={filters.setSearchInput}
            status={filters.status}
            onStatusChange={filters.setStatus}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={clearFilters}
            onView={(patient) => navigate(`/patients/${patient.id}`)}
            page={filters.page}
            totalPages={totalPages}
            totalCount={patientsQuery.data?.total}
            pageSize={filters.pageSize}
            onPageChange={filters.setPage}
            onPageSizeChange={filters.setPageSize}
          />
          <MobileBottomNav />
        </>
      ) : (
        <PatientTable
          patients={patientsQuery.data?.items ?? []}
          loading={patientsQuery.isLoading}
          error={queryError}
          onRetry={() => void patientsQuery.refetch()}
          searchValue={filters.searchInput}
          onSearchChange={filters.setSearchInput}
          searchLoading={patientsQuery.isFetching && !patientsQuery.isPlaceholderData}
          status={filters.status}
          onStatusChange={filters.setStatus}
          onRegister={openCreate}
          selectable
          selectedKeys={selectedKeys}
          onSelectionChange={setSelectedKeys}
          onView={(patient) => navigate(`/patients/${patient.id}`)}
          onEdit={openEdit}
          onDeactivate={canManageStatus ? (patient) => setStatusState({ patient, intent: 'deactivate' }) : undefined}
          onReactivate={canManageStatus ? (patient) => setStatusState({ patient, intent: 'reactivate' }) : undefined}
          onRowClick={(patient) => navigate(`/patients/${patient.id}`)}
        />
      )}

      {!isMobile && (
        <Pagination
          currentPage={filters.page}
          totalPages={totalPages}
          onPageChange={filters.setPage}
          totalCount={patientsQuery.data?.total}
          pageSize={filters.pageSize}
        />
      )}

      <PatientFormContainer
        key={formState?.mode === 'edit' ? formState.patient.id : 'create'}
        open={formState !== null}
        mode={formState?.mode ?? 'create'}
        patientId={formState?.mode === 'edit' ? formState.patient.id : null}
        onClose={closeForm}
        onCreated={(patient) => navigate(`/patients/${patient.id}`)}
      />

      <PatientStatusDialog
        open={statusState !== null}
        patient={statusState?.patient ?? null}
        intent={statusState?.intent ?? null}
        submitting={statusSubmitting}
        error={statusError}
        onConfirm={handleStatusConfirm}
        onClose={() => {
          setStatusState(null);
          setStatusError(null);
        }}
      />
    </div>
  );
};
