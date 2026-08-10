import type { FC } from 'react';
import { PageHeader } from '../../components/common/PageHeader/PageHeader';
import { PageWrapper } from '../../layouts/components/PageWrapper';
import { ContentContainer } from '../../layouts/components/ContentContainer';
import { PatientListContainer } from '../../components/patients/containers/PatientListContainer';
import { useIsMobileViewport } from '../../hooks/useIsMobileViewport';

/**
 * PatientListPage — /patients route page.
 *
 * Thin composition layer: page-level header + the list container. All
 * orchestration (querying, search/filter/pagination, drawer, dialogs) lives
 * in PatientListContainer. On the phone breakpoint the container renders
 * its own compact mobile header + bottom navigation, so the desktop
 * PageHeader is hidden there.
 */
export const PatientListPage: FC = () => {
  const isMobile = useIsMobileViewport();
  return (
    <ContentContainer width="wide">
      <PageWrapper>
        {!isMobile && (
          <PageHeader
            title="Patients"
            subtitle="Search, filter and manage patient records."
          />
        )}
        <PatientListContainer />
      </PageWrapper>
    </ContentContainer>
  );
};
