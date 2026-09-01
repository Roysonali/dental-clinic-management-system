import { useState, useCallback, type FC } from 'react';
import { useParams } from 'react-router-dom';
import { Pencil, UserCheck, UserX, CalendarCheck, CalendarOff } from 'lucide-react';
import { useDoctorProfile } from '../../../hooks/doctors/useDoctorProfile';
import {
  useActivateDoctor,
  useDeactivateDoctor,
  useToggleAvailability,
  useToggleLeave,
  useReplaceWeekSchedule,
} from '../../../hooks/doctors/useDoctorMutations';
import { usePermission } from '../../../hooks/rbac/usePermission';
import { parseApiError } from '../../../services/apiError';
import { DoctorHeader } from '../DoctorHeader';
import { DoctorProfileCard } from '../DoctorProfileCard';
import { DoctorClinicalCard } from '../DoctorClinicalCard';
import { DoctorEmergencyCard } from '../DoctorEmergencyCard';
import { DoctorSpecializationsSection } from '../DoctorSpecializationsSection';
import { DoctorScheduleSection } from '../DoctorScheduleSection';
import { DoctorScheduleEditor } from '../DoctorScheduleEditor';
import { DoctorScheduleRevertDialog } from '../DoctorScheduleRevertDialog';
import { DoctorAppointmentList } from '../DoctorAppointmentList';
import { DoctorTreatmentPlanList } from '../DoctorTreatmentPlanList';
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
import { ContentContainer } from '../../../layouts/components/ContentContainer';
import type { DoctorProfileResponse } from '../../../types/doctor';

/**
 * DoctorDetailsContainer — orchestrates the doctor details page.
 *
 * Loads the profile via GET /doctors/{id}/profile (the single source for
 * the header, overview cards, specializations and weekly schedule), owns
 * the edit drawer + status/toggle dialogs, and renders real tab content
 * for Appointments and Treatment Plans (consumed from their respective modules).
 *
 * Final tab structure:
 *   Overview — Doctor profile, clinical info, specializations, working schedule
 *   Appointments — Doctor-filtered appointments (doctor.user_id → dentist_id)
 *   Treatment Plans — Doctor-filtered treatment plans (doctor.id → doctor_id)
 *
 * Billing tab is intentionally removed (architectural decision — Invoice.doctor_id
 * is nullable and inconsistently populated; no reliable revenue attribution).
 */
export const DoctorDetailsContainer: FC = () => {
  const { doctorId } = useParams<{ doctorId: string }>();
  const profileQuery = useDoctorProfile(doctorId);

  const [editOpen, setEditOpen] = useState(false);
  const [statusState, setStatusState] = useState<{ intent: DoctorStatusIntent } | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [toggleState, setToggleState] = useState<{ intent: DoctorToggleIntent } | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  // Schedule editor state (F-0: schedule management wiring)
  const [scheduleEditorOpen, setScheduleEditorOpen] = useState(false);
  const [revertDialogOpen, setRevertDialogOpen] = useState(false);

  const activateMutation = useActivateDoctor();
  const deactivateMutation = useDeactivateDoctor();
  const availabilityMutation = useToggleAvailability();
  const leaveMutation = useToggleLeave();
  const replaceScheduleMutation = useReplaceWeekSchedule();
  const permission = usePermission();

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

  // ── Schedule management handlers (F-0) ──────────────────────────────────

  const handleScheduleSave = useCallback(
    (schedules: import('../../../types/doctor').ScheduleCreateRequest[]) => {
      if (!profileQuery.data) return;
      replaceScheduleMutation.mutate(
        { doctorId: profileQuery.data.id, schedules },
        {
          onSuccess: () => setScheduleEditorOpen(false),
          // Error is surfaced via replaceScheduleMutation.error
        },
      );
    },
    [profileQuery.data, replaceScheduleMutation],
  );

  const handleRevertConfirm = useCallback(() => {
    if (!profileQuery.data) return;
    replaceScheduleMutation.mutate(
      { doctorId: profileQuery.data.id, schedules: [] },
      {
        onSuccess: () => setRevertDialogOpen(false),
        // Error is surfaced via replaceScheduleMutation.error
      },
    );
  },
  [profileQuery.data, replaceScheduleMutation]);

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
            <Tabs.Trigger value="appointments" label="Appointments" />
            <Tabs.Trigger value="treatment-plans" label="Treatment Plans" />
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
                <DoctorScheduleSection
                doctor={doctor}
                isAdmin={permission.isAdmin}
                onEditSchedule={() => setScheduleEditorOpen(true)}
                onRevertSchedule={() => setRevertDialogOpen(true)}
              />
              </div>

              {/* Right column */}
              <div className="flex flex-col gap-6">
                <DoctorSpecializationsSection doctor={doctor} />
              </div>
            </div>
          </Tabs.Content>

          {/* ── Appointments (consumed from the Appointment module) ── */}
          <Tabs.Content value="appointments" lazy className="mt-6">
            <div className="rounded-xl border border-neutral-200 bg-white p-6">
              <DoctorAppointmentList doctor={doctor} />
            </div>
          </Tabs.Content>

          {/* ── Treatment Plans (consumed from the Treatment Plan module) ── */}
          <Tabs.Content value="treatment-plans" lazy className="mt-6">
            <div className="rounded-xl border border-neutral-200 bg-white p-6">
              <DoctorTreatmentPlanList doctor={doctor} />
            </div>
          </Tabs.Content>
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

      {/* ── Schedule Editor (F-0: wired into Doctor Details) ── */}
      <DoctorScheduleEditor
        open={scheduleEditorOpen}
        onClose={() => setScheduleEditorOpen(false)}
        doctor={doctor}
        hasCustomSchedules={doctor.schedules.length > 0}
        onSave={handleScheduleSave}
        saving={replaceScheduleMutation.isPending}
        error={replaceScheduleMutation.error ? parseApiError(replaceScheduleMutation.error).message : null}
      />

      {/* ── Schedule Revert Dialog (F-0: wired into Doctor Details) ── */}
      <DoctorScheduleRevertDialog
        open={revertDialogOpen}
        doctor={doctor}
        submitting={replaceScheduleMutation.isPending}
        error={replaceScheduleMutation.error ? parseApiError(replaceScheduleMutation.error).message : null}
        onConfirm={handleRevertConfirm}
        onClose={() => setRevertDialogOpen(false)}
      />
    </ContentContainer>
  );
};
