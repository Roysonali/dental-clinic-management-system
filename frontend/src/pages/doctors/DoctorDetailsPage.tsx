import type { FC } from 'react';
import { DoctorDetailsContainer } from '../../components/doctors/containers/DoctorDetailsContainer';

/**
 * DoctorDetailsPage — /doctors/:doctorId route page.
 *
 * Thin route wrapper; the container owns loading, error handling, tabs,
 * edit drawer and status/toggle dialogs.
 */
export const DoctorDetailsPage: FC = () => {
  return <DoctorDetailsContainer />;
};
