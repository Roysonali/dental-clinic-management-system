import type { FC } from 'react';
import { PageHeader } from '../../components/common/PageHeader/PageHeader';
import { PageWrapper } from '../../layouts/components/PageWrapper';
import { ContentContainer } from '../../layouts/components/ContentContainer';
import { PatientRecordListContainer } from '../../components/patientRecords/containers/PatientRecordListContainer';
import { useIsMobileViewport } from '../../hooks/useIsMobileViewport';

/**
 * PatientRecordListPage — /patient-records route page (S-01).
 *
 * Thin composition layer: page-level PageHeader + the list container. All
 * orchestration (queries, filters, names, create drawer) lives in
 * PatientRecordListContainer.
 */
export const PatientRecordListPage: FC = () => {
  const isMobile = useIsMobileViewport();
  return (
    <ContentContainer width="wide">
      <PageWrapper>
        {!isMobile && (
          <PageHeader
            title="Patient Records"
            subtitle="Clinical charts attached to appointments."
          />
        )}
        <PatientRecordListContainer />
      </PageWrapper>
    </ContentContainer>
  );
};
