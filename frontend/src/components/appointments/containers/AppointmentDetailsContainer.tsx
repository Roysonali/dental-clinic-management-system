import { useMemo, useState, type FC } from 'react';
import { useParams } from 'react-router-dom';
import { Pencil, CalendarX2 } from 'lucide-react';
import { useAppointment } from '../../../hooks/appointments/useAppointment';
import { useAppointmentNames } from '../../../hooks/appointments/useAppointmentNames';
import { useCancelAppointment } from '../../../hooks/appointments/useAppointmentMutations';
import { apiErrorMessage, parseApiError } from '../../../services/apiError';
import { canCancelAppointment } from '../../../constants/appointment';
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
import type { EnrichedAppointment } from '../../../types/appointment';

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

  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const appointment = appointmentQuery.data;

  const names = useAppointmentNames(
    useMemo(() => (appointment ? [appointment.patient_id] : []), [appointment]),
    useMemo(() => (appointment ? [appointment.dentist_id] : []), [appointment]),
  );

  const enriched = useMemo<EnrichedAppointment | null>(
    () =>
      appointment
        ? {
            ...appointment,
            patient_name: names.data?.patientNames.get(appointment.patient_id) ?? null,
            dentist_name: names.data?.dentistNames.get(appointment.dentist_id) ?? null,
          }
        : null,
    [appointment, names.data],
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

  const isCompleted = appointment.status === 'Completed';

  return (
    <ContentContainer width="wide">
      <div className="flex flex-col gap-6">
        <AppointmentDetailsHeader
          appointment={enriched}
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={isCompleted}
                onClick={() => setEditOpen(true)}
                leftIcon={<Icon icon={Pencil} size="sm" />}
              >
                Edit
              </Button>
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
