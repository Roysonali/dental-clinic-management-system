import { useMemo } from 'react';
import type { FC } from 'react';
import { Stack } from '../common/Stack/Stack';
import { Skeleton } from '../common/Skeleton/Skeleton';
import { EmptyState } from '../common/EmptyState/EmptyState';
import { UpcomingAppointmentCard } from './UpcomingAppointmentCard';
import { useTodayAppointments } from '../../hooks/appointments/useTodayAppointments';
import { useAppointmentNames } from '../../hooks/appointments/useAppointmentNames';
import type { AppointmentResponse } from '../../types/appointment';

interface UpcomingAppointmentsProps {
  /** Maximum number of today's appointments to surface on the dashboard. */
  limit?: number;
}

function uniquePatientIds(items: AppointmentResponse[]): string[] {
  return Array.from(new Set(items.map((a) => a.patient_id))).sort();
}

function uniqueDentistIds(items: AppointmentResponse[]): number[] {
  return Array.from(new Set(items.map((a) => a.dentist_id))).sort((a, b) => a - b);
}

/**
 * UpcomingAppointments — dashboard widget bound to GET /appointments/today.
 *
 * Resolves patient/dentist names best-effort (see `useAppointmentNames`),
 * falling back to id-based labels when a name can't be read.
 */
export const UpcomingAppointments: FC<UpcomingAppointmentsProps> = ({
  limit = 8,
}) => {
  const today = useTodayAppointments();
  const items = (today.data ?? []).slice(0, limit);

  const patientIds = useMemo(() => uniquePatientIds(items), [items]);
  const dentistIds = useMemo(() => uniqueDentistIds(items), [items]);
  const names = useAppointmentNames(patientIds, dentistIds);

  const patientNames = names.data?.patientNames;
  const dentistNames = names.data?.dentistNames;

  if (today.isLoading) {
    return (
      <Stack spacing={3}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </Stack>
    );
  }

  if (today.isError) {
    return (
      <p className="text-body-sm text-neutral-500">
        Appointments could not be loaded.
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="No appointments today"
        description="Enjoy a quiet day — there are no appointments scheduled."
      />
    );
  }

  return (
    <Stack spacing={3}>
      {items.map((appointment) => (
        <UpcomingAppointmentCard
          key={appointment.id}
          patientName={patientNames?.get(appointment.patient_id) ?? `Patient #${appointment.patient_id}`}
          dentistName={dentistNames?.get(appointment.dentist_id)}
          start_time={appointment.start_time}
          end_time={appointment.end_time}
          type={appointment.appointment_type}
          status={appointment.status}
        />
      ))}
    </Stack>
  );
};
