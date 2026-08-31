import { useMemo, useState, type FC } from 'react';
import { useParams } from 'react-router-dom';
import { Pencil, CalendarX2, ArrowRight } from 'lucide-react';
import { useAppointment } from '../../../hooks/appointments/useAppointment';
import { useCancelAppointment, useUpdateAppointmentStatus } from '../../../hooks/appointments/useAppointmentMutations';
import { apiErrorMessage, parseApiError } from '../../../services/apiError';
import {
  canCancelAppointment,
  isTerminalStatus,
  getGenericNextStatuses,
  STATUS_ACTION_LABELS,
} from '../../../constants/appointment';
import { AppointmentDetailsHeader } from '../AppointmentDetailsHeader';
import { AppointmentInfoCard } from '../AppointmentInfoCard';
import { AppointmentPartiesCard } from '../AppointmentPartiesCard';
import { AppointmentFormContainer } from './AppointmentFormContainer';
import { CancelAppointmentDialog } from '../CancelAppointmentDialog';
import { Button } from '../../common/Button/Button';
import { Icon } from '../../common/Icon/Icon';
import { Spinner } from '../../common/Spinner/Spinner';
import { ResultState } from '../../common/ResultState/ResultState';
import { ContentContainer } from '../../../layouts/components/ContentContainer';
import type { AppointmentStatus, EnrichedAppointment } from '../../../types/appointment';

/**
 * AppointmentDetailsContainer — orchestrates the appointment details page.
 *
 * Loads the appointment by route param, enriches patient/dentist names
 * best-effort, and owns the edit drawer + cancel confirmation dialog.
 * Backend limitations mirrored: no status-transition endpoint exists (cancel
 * is the only lifecycle action), and only COMPLETED appointments are blocked
 * from editing by the service layer.
 */
export const AppointmentDetailsContainer: FC = () => {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const appointmentQuery = useAppointment(appointmentId);
  const cancelMutation = useCancelAppointment();
  const statusMutation = useUpdateAppointmentStatus();

  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const appointment = appointmentQuery.data;

  // Backend now returns patient_name and dentist_name via eager-loaded
  // relationships, eliminating the need for useAppointmentNames N+1 calls.
  const enriched = useMemo<EnrichedAppointment | null>(
    () =>
      appointment
        ? {
            ...appointment,
            patient_name: appointment.patient_name ?? null,
            dentist_name: appointment.dentist_name ?? null,
          }
        : null,
    [appointment],
  );

  const errorMessage = appointmentQuery.error
    ? apiErrorMessage(appointmentQuery.error)
    : null;

  const handleCancelConfirm = () => {
    if (!appointment) return;
    setCancelError(null);
    cancelMutation.mutate(appointment.id, {
      onSuccess: () => setCancelOpen(false),
      onError: (error) => setCancelError(parseApiError(error).message),
    });
  };

  const handleStatusTransition = (nextStatus: AppointmentStatus) => {
    if (!appointment) return;
    setStatusError(null);
    statusMutation.mutate(
      { id: appointment.id, status: nextStatus },
      {
        onError: (error) => setStatusError(parseApiError(error).message),
      },
    );
  };

  if (appointmentQuery.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center" role="status" aria-label="Loading appointment">
        <Spinner size="lg" variant="primary" />
      </div>
    );
  }

  if (appointmentQuery.isError || !appointment || !enriched) {
    return (
      <ContentContainer width="wide">
        <div className="rounded-xl border border-danger/20 bg-danger/5 p-8">
          <ResultState
            variant="error"
            title="Unable to load appointment"
            description={errorMessage ?? 'This appointment could not be found.'}
            actions={
              <Button variant="primary" size="md" onClick={() => void appointmentQuery.refetch()}>
                Retry
              </Button>
            }
          />
        </div>
      </ContentContainer>
    );
  }

  const canEdit = !isTerminalStatus(appointment.status);
  const genericNextStatuses = getGenericNextStatuses(appointment.status);

  return (
    <ContentContainer width="wide">
      <div className="flex flex-col gap-6">
        <AppointmentDetailsHeader
          appointment={enriched}
          actions={
            <>
              {genericNextStatuses.map((next) => (
                <Button
                  key={next}
                  variant="primary"
                  size="sm"
                  disabled={statusMutation.isPending}
                  onClick={() => handleStatusTransition(next)}
                  leftIcon={<Icon icon={ArrowRight} size="sm" />}
                >
                  {STATUS_ACTION_LABELS[next]}
                </Button>
              ))}
              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditOpen(true)}
                  leftIcon={<Icon icon={Pencil} size="sm" />}
                >
                  Edit
                </Button>
              )}
              {canCancelAppointment(appointment.status) && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    setCancelError(null);
                    setCancelOpen(true);
                  }}
                  leftIcon={<Icon icon={CalendarX2} size="sm" />}
                >
                  Cancel Appointment
                </Button>
              )}
            </>
          }
        />

        {statusError && (
          <div className="rounded-lg border border-danger/20 bg-danger/5 p-3 text-body-sm text-danger">
            {statusError}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <AppointmentInfoCard appointment={appointment} />
          </div>
          <div>
            <AppointmentPartiesCard appointment={enriched} />
          </div>
        </div>
      </div>

      <AppointmentFormContainer
        key={appointment.id}
        open={editOpen}
        mode="edit"
        appointmentId={appointment.id}
        onClose={() => setEditOpen(false)}
      />

      <CancelAppointmentDialog
        open={cancelOpen}
        appointment={enriched}
        submitting={cancelMutation.isPending}
        error={cancelError}
        onConfirm={handleCancelConfirm}
        onClose={() => {
          setCancelOpen(false);
          setCancelError(null);
        }}
      />
    </ContentContainer>
  );
};
