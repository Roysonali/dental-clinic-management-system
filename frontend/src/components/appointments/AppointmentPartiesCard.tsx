import type { FC } from 'react';
import { Link } from 'react-router-dom';
import { User, Stethoscope } from 'lucide-react';
import { PatientAvatar } from '../patients/PatientAvatar';
import { Icon } from '../common/Icon/Icon';
import { ROUTES } from '../../routes/routes';
import type { EnrichedAppointment } from '../../types/appointment';

interface AppointmentPartiesCardProps {
  /** Enriched appointment (includes resolved patient/dentist names) */
  appointment: EnrichedAppointment;
}

/**
 * AppointmentPartiesCard — patient and dentist summary for the details page.
 *
 * The patient links through to the patient's record (that route exists).
 * There is no doctor frontend module yet, so the dentist is display-only.
 */
export const AppointmentPartiesCard: FC<AppointmentPartiesCardProps> = ({ appointment }) => {
  const patientName = appointment.patient_name ?? `Patient #${appointment.patient_id}`;
  const dentistName = appointment.dentist_name ?? `Dentist #${appointment.dentist_id}`;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <h3 className="mb-3 text-h4 font-semibold text-neutral-900">People</h3>

      <div className="space-y-4">
        {/* Patient */}
        <div className="flex items-center gap-3">
          <PatientAvatar fullName={patientName} size="md" />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-body-sm font-medium text-neutral-600">
              <Icon icon={User} size="xs" className="text-neutral-400" />
              Patient
            </p>
            <Link
              to={`${ROUTES.PATIENTS}/${appointment.patient_id}`}
              className="block truncate font-semibold text-neutral-900 transition-colors duration-150 hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
            >
              {patientName}
            </Link>
          </div>
        </div>

        {/* Dentist */}
        <div className="flex items-center gap-3 border-t border-neutral-100 pt-4">
          <PatientAvatar fullName={dentistName} size="md" />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-body-sm font-medium text-neutral-600">
              <Icon icon={Stethoscope} size="xs" className="text-neutral-400" />
              Dentist
            </p>
            <p className="truncate font-semibold text-neutral-900">{dentistName}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
