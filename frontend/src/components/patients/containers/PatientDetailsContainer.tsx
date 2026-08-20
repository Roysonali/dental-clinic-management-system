import { useState, type FC } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Pencil, UserCheck, UserX } from 'lucide-react';
import { ROUTES } from '../../../routes/routes';
import { usePatient } from '../../../hooks/patients/usePatient';
import { useActivatePatient, useDeactivatePatient } from '../../../hooks/patients/usePatientMutations';
import { parseApiError } from '../../../services/apiError';
import { PatientHeader } from '../PatientHeader';
import { PatientInfoCard } from '../PatientInfoCard';
import { EmergencyContactCard } from '../EmergencyContactCard';
import { ClinicalSummaryCard } from '../ClinicalSummaryCard';
import { AlertsCard } from '../AlertsCard';
import { AllergiesCard } from '../AllergiesCard';
import { ActivityTimeline } from '../ActivityTimeline';
import { QuickActionsCard } from '../QuickActionsCard';
import { UpcomingAppointmentCard } from '../UpcomingAppointmentCard';
import { TreatmentSummaryCard } from '../TreatmentSummaryCard';
import { PatientFormContainer } from './PatientFormContainer';
import { PatientStatusDialog } from '../PatientStatusDialog';
import type { PatientStatusIntent } from '../PatientStatusDialog';
import { PermissionGate } from '../../rbac/PermissionGate';
import { usePermission } from '../../../hooks/rbac/usePermission';
import { ADMIN_ROLES } from '../../../constants/roles';
import { Tabs } from '../../common/Tabs/Tabs';
import { Button } from '../../common/Button/Button';
import { Icon } from '../../common/Icon/Icon';
import { Spinner } from '../../common/Spinner/Spinner';
import { ResultState } from '../../common/ResultState/ResultState';
import { EmptyState } from '../../common/EmptyState/EmptyState';
import { ContentContainer } from '../../../layouts/components/ContentContainer';
import type { PatientResponse } from '../../../types/patient';

/* ── Empty-state placeholders for tabs owned by other modules ───────── */

function EmptyTab({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-8">
      <EmptyState title={title} description={description} />
    </div>
  );
}

/**
 * BackToPatientsButton — detail-page Back control, mirroring the Users
 * module's pattern (ghost Button + ChevronLeft → ROUTES.PATIENTS).
 * Rendered in every state (loading / error / loaded) so mobile users can
 * always return to the Patient list without relying on the browser back
 * button.
 */
function BackToPatientsButton() {
  const navigate = useNavigate();
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => navigate(ROUTES.PATIENTS)}
      leftIcon={<Icon icon={ChevronLeft} size="sm" />}
      className="self-start"
    >
      Back to Patients
    </Button>
  );
}

const UNWIRED_TABS = [
  {
    value: 'records',
    label: 'Records',
    title: 'No patient records yet',
    description: 'Clinical records for this patient will appear here once the Records module is connected.',
  },
  {
    value: 'treatment-plans',
    label: 'Treatment Plans',
    title: 'No treatment plans',
    description: 'Treatment plans for this patient will appear here once the Treatment module is connected.',
  },
  {
    value: 'appointments',
    label: 'Appointments',
    title: 'No appointments',
    description: 'Appointments for this patient will appear here once the Appointments module is connected.',
  },
  {
    value: 'billing',
    label: 'Billing',
    title: 'No billing activity',
    description: 'Invoices and payments for this patient will appear here once the Billing module is connected.',
  },
  {
    value: 'timeline',
    label: 'Timeline',
    title: 'No timeline entries',
    description: 'The full patient activity timeline will appear here.',
  },
  {
    value: 'audit',
    label: 'Audit',
    title: 'No audit entries',
    description: 'The audit trail for this patient record will appear here.',
  },
] as const;

/**
 * PatientDetailsContainer — orchestrates the patient details page.
 *
 * Loads the patient by route param, renders the header + tabbed overview
 * (Overview tab is fully wired from the Patient module; the other tabs are
 * intentional empty states ready for their owning modules), and owns the
 * edit drawer + status dialogs.
 */
export const PatientDetailsContainer: FC = () => {
  const { patientId } = useParams<{ patientId: string }>();
  const patientQuery = usePatient(patientId);

  const [editOpen, setEditOpen] = useState(false);
  const [statusState, setStatusState] = useState<{ intent: PatientStatusIntent } | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const activateMutation = useActivatePatient();
  const deactivateMutation = useDeactivatePatient();
  const statusSubmitting = activateMutation.isPending || deactivateMutation.isPending;

  // Activate/deactivate are ADMIN-only on the backend (require_roles([ADMIN]))
  // — gate them client-side (Sprint 11C). Edit stays visible (ADMIN +
  // RECEPTIONIST — indistinguishable client-side; backend enforces).
  const { can } = usePermission();
  const canManageStatus = can(ADMIN_ROLES);

  const errorMessage = patientQuery.error ? parseApiError(patientQuery.error).message : null;

  const handleStatusConfirm = () => {
    if (!statusState || !patientQuery.data) return;
    setStatusError(null);
    const intent = statusState.intent;
    const mutation = intent === 'deactivate' ? deactivateMutation : activateMutation;
    mutation.mutate(patientQuery.data.id, {
      onSuccess: () => setStatusState(null),
      onError: (error) => setStatusError(parseApiError(error).message),
    });
  };

  if (patientQuery.isLoading) {
    return (
      <ContentContainer width="wide">
        <div className="flex flex-col gap-6">
          <BackToPatientsButton />
          <div className="flex h-64 items-center justify-center" role="status" aria-label="Loading patient">
            <Spinner size="lg" variant="primary" />
          </div>
        </div>
      </ContentContainer>
    );
  }

  if (patientQuery.isError || !patientQuery.data) {
    return (
      <ContentContainer width="wide">
        <div className="flex flex-col gap-6">
          <BackToPatientsButton />
          <div className="rounded-xl border border-danger/20 bg-danger/5 p-8">
            <ResultState
              variant="error"
              title="Unable to load patient"
              description={errorMessage ?? 'This patient could not be found.'}
              actions={
                <Button variant="primary" size="md" onClick={() => void patientQuery.refetch()}>
                  Retry
                </Button>
              }
            />
          </div>
        </div>
      </ContentContainer>
    );
  }

  const patient: PatientResponse = patientQuery.data;

  return (
    <ContentContainer width="wide">
      <div className="flex flex-col gap-6">
        <BackToPatientsButton />

        <PatientHeader
          patient={patient}
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditOpen(true)}
                leftIcon={<Icon icon={Pencil} size="sm" />}
              >
                Edit
              </Button>
              <PermissionGate requiredRoles={ADMIN_ROLES}>
                <Button
                  variant={patient.is_active ? 'danger' : 'success'}
                  size="sm"
                  onClick={() => setStatusState({ intent: patient.is_active ? 'deactivate' : 'reactivate' })}
                  leftIcon={<Icon icon={patient.is_active ? UserX : UserCheck} size="sm" />}
                >
                  {patient.is_active ? 'Deactivate' : 'Reactivate'}
                </Button>
              </PermissionGate>
            </>
          }
        />

        <Tabs defaultValue="overview">
          <Tabs.List>
            <Tabs.Trigger value="overview" label="Overview" />
            {UNWIRED_TABS.map((tab) => (
              <Tabs.Trigger key={tab.value} value={tab.value} label={tab.label} />
            ))}
          </Tabs.List>

          {/* ── Overview (fully wired from the Patient module) ── */}
          <Tabs.Content value="overview" className="mt-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Left column */}
              <div className="flex flex-col gap-6 lg:col-span-2">
                <PatientInfoCard patient={patient} />
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <EmergencyContactCard patient={patient} />
                  <ClinicalSummaryCard patient={patient} />
                </div>
                <UpcomingAppointmentCard />
              </div>

              {/* Right column */}
              <div className="flex flex-col gap-6">
                <QuickActionsCard
                  patient={patient}
                  onEdit={() => setEditOpen(true)}
                  onToggleStatus={
                    canManageStatus
                      ? () =>
                          setStatusState({
                            intent: patient.is_active ? 'deactivate' : 'reactivate',
                          })
                      : undefined
                  }
                />
                <TreatmentSummaryCard />
                <AlertsCard />
                <AllergiesCard />
                <div className="rounded-xl border border-neutral-200 bg-white p-5">
                  <h3 className="mb-3 text-h4 font-semibold text-neutral-900">Recent Activity</h3>
                  <ActivityTimeline patient={patient} />
                </div>
              </div>
            </div>
          </Tabs.Content>

          {/* ── Tabs owned by other modules (intentional empty states) ── */}
          {UNWIRED_TABS.map((tab) => (
            <Tabs.Content key={tab.value} value={tab.value} lazy className="mt-6">
              <EmptyTab title={tab.title} description={tab.description} />
            </Tabs.Content>
          ))}
        </Tabs>
      </div>

      <PatientFormContainer
        key={patient.id}
        open={editOpen}
        mode="edit"
        patientId={patient.id}
        onClose={() => setEditOpen(false)}
      />

      <PatientStatusDialog
        open={statusState !== null}
        patient={patient}
        intent={statusState?.intent ?? null}
        submitting={statusSubmitting}
        error={statusError}
        onConfirm={handleStatusConfirm}
        onClose={() => {
          setStatusState(null);
          setStatusError(null);
        }}
      />
    </ContentContainer>
  );
};
