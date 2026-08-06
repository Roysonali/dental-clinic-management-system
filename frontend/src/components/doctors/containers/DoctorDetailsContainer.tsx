import { useState, type FC } from 'react';
import { useParams } from 'react-router-dom';
import { Pencil, UserCheck, UserX, CalendarCheck, CalendarOff } from 'lucide-react';
import { useDoctorProfile } from '../../../hooks/doctors/useDoctorProfile';
import {
  useActivateDoctor,
  useDeactivateDoctor,
  useToggleAvailability,
  useToggleLeave,
} from '../../../hooks/doctors/useDoctorMutations';
import { parseApiError } from '../../../services/apiError';
import { DoctorHeader } from '../DoctorHeader';
import { DoctorProfileCard } from '../DoctorProfileCard';
import { DoctorClinicalCard } from '../DoctorClinicalCard';
import { DoctorEmergencyCard } from '../DoctorEmergencyCard';
import { DoctorSpecializationsSection } from '../DoctorSpecializationsSection';
import { DoctorScheduleSection } from '../DoctorScheduleSection';
import { DoctorFormContainer } from './DoctorFormContainer';
import { DoctorStatusDialog, type DoctorStatusIntent } from '../DoctorStatusDialog';
import { DoctorToggleDialog, type DoctorToggleIntent } from '../DoctorToggleDialog';
import { PermissionGate } from '../../rbac/PermissionGate';
import { ADMIN_ROLES } from '../../../constants/roles';
import { Tabs } from '../../common/Tabs/Tabs';
import { Button } from '../../common/Button/Button';
import { Icon } from '../../common/Icon/Icon';
import { Spinner } from '../../common/Spinner/Spinner';
import { ResultState } from '../../common/ResultState/ResultState';
import { EmptyState } from '../../common/EmptyState/EmptyState';
import { ContentContainer } from '../../../layouts/components/ContentContainer';
import type { DoctorProfileResponse } from '../../../types/doctor';

/* ── Empty-state placeholders for tabs owned by other modules ───────── */

function EmptyTab({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-8">
      <EmptyState title={title} description={description} />
    </div>
  );
}

const UNWIRED_TABS = [
  {
    value: 'appointments',
    label: 'Appointments',
    title: 'No appointments',
    description: 'Appointments for this doctor will appear here once the Appointments module is connected.',
  },
  {
    value: 'treatment-plans',
    label: 'Treatment Plans',
    title: 'No treatment plans',
    description: 'Treatment plans for this doctor will appear here once the Treatment module is connected.',
  },
  {
    value: 'billing',
    label: 'Billing',
    title: 'No billing activity',
    description: 'Invoices and payments for this doctor will appear here once the Billing module is connected.',
  },
] as const;

/**
 * DoctorDetailsContainer — orchestrates the doctor details page.
 *
 * Loads the profile via GET /doctors/{id}/profile (the single source for
 * the header, overview cards, specializations and weekly schedule), owns
 * the edit drawer + status/toggle dialogs, and renders placeholder tabs
 * for modules that are not yet wired (Patient convention).
 */
export const DoctorDetailsContainer: FC = () => {
  const { doctorId } = useParams<{ doctorId: string }>();
  const profileQuery = useDoctorProfile(doctorId);

  const [editOpen, setEditOpen] = useState(false);
  const [statusState, setStatusState] = useState<{ intent: DoctorStatusIntent } | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [toggleState, setToggleState] = useState<{ intent: DoctorToggleIntent } | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const activateMutation = useActivateDoctor();
  const deactivateMutation = useDeactivateDoctor();
  const availabilityMutation = useToggleAvailability();
  const leaveMutation = useToggleLeave();

  const statusSubmitting = activateMutation.isPending || deactivateMutation.isPending;
  const toggleSubmitting = availabilityMutation.isPending || leaveMutation.isPending;

  const errorMessage = profileQuery.error ? parseApiError(profileQuery.error).message : null;

  const handleStatusConfirm = () => {
    if (!statusState || !profileQuery.data) return;
    setStatusError(null);
    const intent = statusState.intent;
    const mutation = intent === 'deactivate' ? deactivateMutation : activateMutation;
    mutation.mutate(profileQuery.data.id, {
      onSuccess: () => setStatusState(null),
      onError: (error) => setStatusError(parseApiError(error).message),
    });
  };

  const handleToggleConfirm = () => {
    if (!toggleState || !profileQuery.data) return;
    setToggleError(null);
    const intent = toggleState.intent;
    const mutation = intent === 'availability' ? availabilityMutation : leaveMutation;
    mutation.mutate(profileQuery.data.id, {
      onSuccess: () => setToggleState(null),
      onError: (error) => setToggleError(parseApiError(error).message),
    });
  };

  if (profileQuery.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center" role="status" aria-label="Loading doctor">
        <Spinner size="lg" variant="primary" />
      </div>
    );
  }

  if (profileQuery.isError || !profileQuery.data) {
    return (
      <div className="rounded-xl border border-danger/20 bg-danger/5 p-8">
        <ResultState
          variant="error"
          title="Unable to load doctor"
          description={errorMessage ?? 'This doctor could not be found.'}
          actions={
            <Button variant="primary" size="md" onClick={() => void profileQuery.refetch()}>
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  const doctor: DoctorProfileResponse = profileQuery.data;

  return (
    <ContentContainer width="wide">
      <div className="flex flex-col gap-6">
        <DoctorHeader
          doctor={doctor}
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
              {/* Activate/deactivate are ADMIN-only on the backend
                  (require_roles([ADMIN])) — gate them client-side (Sprint
                  11C). Edit + availability/leave toggles stay visible to
                  the role sets the backend permits. */}
              <PermissionGate requiredRoles={ADMIN_ROLES}>
                <Button
                  variant={doctor.is_active ? 'danger' : 'success'}
                  size="sm"
                  onClick={() => setStatusState({ intent: doctor.is_active ? 'deactivate' : 'activate' })}
                  leftIcon={<Icon icon={doctor.is_active ? UserX : UserCheck} size="sm" />}
                >
                  {doctor.is_active ? 'Deactivate' : 'Activate'}
                </Button>
              </PermissionGate>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setToggleState({ intent: 'availability' })}
                leftIcon={<Icon icon={CalendarCheck} size="sm" />}
              >
                Toggle Availability
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setToggleState({ intent: 'leave' })}
                leftIcon={<Icon icon={CalendarOff} size="sm" />}
              >
                Toggle Leave
              </Button>
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

          {/* ── Overview (fully wired from the Doctor module) ── */}
          <Tabs.Content value="overview" className="mt-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Left column */}
              <div className="flex flex-col gap-6 lg:col-span-2">
                <DoctorProfileCard doctor={doctor} />
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <DoctorClinicalCard doctor={doctor} />
                  <DoctorEmergencyCard doctor={doctor} />
                </div>
                <DoctorScheduleSection doctor={doctor} />
              </div>

              {/* Right column */}
              <div className="flex flex-col gap-6">
                <DoctorSpecializationsSection doctor={doctor} />
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

      <DoctorFormContainer
        key={doctor.id}
        open={editOpen}
        mode="edit"
        doctorId={doctor.id}
        onClose={() => setEditOpen(false)}
      />

      <DoctorStatusDialog
        open={statusState !== null}
        doctor={doctor}
        intent={statusState?.intent ?? null}
        submitting={statusSubmitting}
        error={statusError}
        onConfirm={handleStatusConfirm}
        onClose={() => {
          setStatusState(null);
          setStatusError(null);
        }}
      />

      <DoctorToggleDialog
        open={toggleState !== null}
        doctor={doctor}
        intent={toggleState?.intent ?? null}
        submitting={toggleSubmitting}
        error={toggleError}
        onConfirm={handleToggleConfirm}
        onClose={() => {
          setToggleState(null);
          setToggleError(null);
        }}
      />
    </ContentContainer>
  );
};
