import { useMemo, useState, type FC } from 'react';
import { AppointmentDrawer } from '../AppointmentDrawer';
import {
  useCreateAppointment,
  useUpdateAppointment,
} from '../../../hooks/appointments/useAppointmentMutations';
import { useAppointment } from '../../../hooks/appointments/useAppointment';
import { useAppointmentNames } from '../../../hooks/appointments/useAppointmentNames';
import { useDoctors } from '../../../hooks/doctors/useDoctors';
import {
  appointmentToFormValues,
  formValuesToCreatePayload,
  formValuesToUpdatePayload,
} from '../appointmentFormUtils';
import { parseApiError } from '../../../services/apiError';
import type {
  AppointmentFormValues,
  AppointmentResponse,
} from '../../../types/appointment';

interface AppointmentFormContainerProps {
  /** Drawer open state */
  open: boolean;
  /** Create vs edit mode */
  mode: 'create' | 'edit';
  /** Appointment id to edit (edit mode); the full record is fetched on open */
  appointmentId?: string | null;
  /** Patient id to pre-fill when creating from a patient context */
  patientId?: string | null;
  /** Called to close the drawer */
  onClose: () => void;
  /** Called after a successful create (e.g. to navigate to the new record) */
  onCreated?: (appointment: AppointmentResponse) => void;
}

/**
 * AppointmentFormContainer — orchestrates the create/edit drawer.
 *
 * Owns submission, loading, server-error mapping and the mutations; the
 * presentational AppointmentForm/AppointmentDrawer stay pure. Both Create
 * and Edit flow through this single container — no duplicated form logic.
 */
export const AppointmentFormContainer: FC<AppointmentFormContainerProps> = ({
  open,
  mode,
  appointmentId,
  patientId,
  onClose,
  onCreated,
}) => {
  const createMutation = useCreateAppointment();
  const updateMutation = useUpdateAppointment();
  const isEdit = mode === 'edit';

  // Edit mode fetches the full appointment record when the drawer opens.
  const appointmentQuery = useAppointment(appointmentId, open && isEdit);
  const appointment = appointmentQuery.data;

  // Only fetch the dentist list while the drawer is actually open — the list
  // and details pages must not fire GET /doctors on every load (and for
  // doctor-role users that endpoint 403s, so the request would be wasted).
  const doctorsQuery = useDoctors(open && !(isEdit && appointmentQuery.isLoading));

  // Resolve the fixed patient's display name for the picker label (edit mode).
  const names = useAppointmentNames(
    useMemo(() => (appointment ? [appointment.patient_id] : []), [appointment]),
    useMemo(() => (appointment ? [appointment.dentist_id] : []), [appointment]),
  );

  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});

  // Clear transient server errors whenever the drawer closes so a failed
  // submit never lingers into the next open cycle.
  const handleClose = () => {
    setServerMessage(null);
    setServerErrors({});
    onClose();
  };

  const submitting = createMutation.isPending || updateMutation.isPending;

  /* ── Dentist dropdown options ─────────────────────────────────── */

  const dentistOptions = useMemo(() => {
    const options = (doctorsQuery.data?.items ?? []).map((d) => ({
      value: String(d.user_id),
      label: d.user_full_name ?? d.doctor_code ?? `Dentist #${d.user_id}`,
    }));
    // Edit mode: keep the current dentist selectable even if the list
    // failed to load (e.g. doctor-role user without list permission).
    if (isEdit && appointment && !options.some((o) => o.value === String(appointment.dentist_id))) {
      const dentistName = names.data?.dentistNames.get(appointment.dentist_id);
      options.unshift({
        value: String(appointment.dentist_id),
        label: dentistName ?? `Dentist #${appointment.dentist_id}`,
      });
    }
    return options;
  }, [doctorsQuery.data, isEdit, appointment, names.data]);

  const handleSubmit = (values: AppointmentFormValues) => {
    setServerMessage(null);
    setServerErrors({});

    if (isEdit && appointmentId) {
      updateMutation.mutate(
        { id: appointmentId, payload: formValuesToUpdatePayload(values) },
        {
          onSuccess: () => onClose(),
          onError: (error) => {
            const info = parseApiError(error);
            setServerMessage(info.message);
            setServerErrors(info.fieldErrors);
          },
        },
      );
      return;
    }

    createMutation.mutate(formValuesToCreatePayload(values), {
      onSuccess: (created) => {
        onClose();
        onCreated?.(created);
      },
      onError: (error) => {
        const info = parseApiError(error);
        setServerMessage(info.message);
        setServerErrors(info.fieldErrors);
      },
    });
  };

  return (
    <AppointmentDrawer
      open={open}
      mode={mode}
      onClose={handleClose}
      onSubmit={handleSubmit}
      submitting={submitting}
      loading={isEdit && appointmentQuery.isLoading}
      disabled={isEdit && appointmentQuery.isLoading}
      initialValues={
        appointment
          ? appointmentToFormValues(appointment)
          : patientId
            ? { patient_id: patientId }
            : undefined
      }
      serverMessage={serverMessage}
      serverErrors={serverErrors}
      dentistOptions={dentistOptions}
      dentistsLoading={doctorsQuery.isLoading}
      dentistsError={doctorsQuery.isError}
      patientEditable={!isEdit}
      patientName={
        isEdit && appointment
          ? (names.data?.patientNames.get(appointment.patient_id) ?? null)
          : null
      }
    />
  );
};
