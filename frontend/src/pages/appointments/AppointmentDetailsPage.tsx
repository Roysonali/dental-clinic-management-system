import type { FC } from 'react';
import { AppointmentDetailsContainer } from '../../components/appointments/containers/AppointmentDetailsContainer';

/**
 * AppointmentDetailsPage — /appointments/:appointmentId route page.
 *
 * Thin route wrapper; the container owns loading, error handling, the edit
 * drawer and the cancel dialog.
 */
export const AppointmentDetailsPage: FC = () => {
  return <AppointmentDetailsContainer />;
};
