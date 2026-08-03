import type { FC } from 'react';
import { PageHeader } from '../../components/common/PageHeader/PageHeader';
import { PageWrapper } from '../../layouts/components/PageWrapper';
import { ContentContainer } from '../../layouts/components/ContentContainer';
import { PatientListContainer } from '../../components/patients/containers/PatientListContainer';

/**
 * PatientListPage — /patients route page.
 *
 * Thin composition layer: page-level header + the list container. All
 * orchestration (querying, search/filter/pagination, drawer, dialogs) lives
 * in PatientListContainer.
 */
export const PatientListPage: FC = () => {
  return (
    <ContentContainer width="wide">
      <PageWrapper>
        <PageHeader
          title="Patients"
          subtitle="Search, filter and manage patient records."
        />
        <PatientListContainer />
      </PageWrapper>
    </ContentContainer>
  );
};
