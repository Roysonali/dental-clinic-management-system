import type { FC } from 'react';
import { useParams } from 'react-router-dom';
import { PatientRecordDetailsContainer } from '../../components/patientRecords/containers/PatientRecordDetailsContainer';

/**
 * PatientRecordDetailsPage — /patient-records/:recordId route page (S-02).
 *
 * Thin route wrapper; the container owns loading, error handling, tabs,
 * edit drawer and status dialogs.
 */
export const PatientRecordDetailsPage: FC = () => {
  const { recordId } = useParams<{ recordId: string }>();

  if (!recordId) return null;
  return <PatientRecordDetailsContainer recordId={recordId} />;
};
