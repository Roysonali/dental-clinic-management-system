import type { FC } from 'react';
import { PatientDetailsContainer } from '../../components/patients/containers/PatientDetailsContainer';

/**
 * PatientDetailsPage — /patients/:patientId route page.
 *
 * Thin route wrapper; the container owns loading, error handling, tabs,
 * edit drawer and status dialogs.
 */
export const PatientDetailsPage: FC = () => {
  return <PatientDetailsContainer />;
};
