import type { FC } from 'react';
import { PageHeader } from '../../components/common/PageHeader/PageHeader';
import { PageWrapper } from '../../layouts/components/PageWrapper';
import { ContentContainer } from '../../layouts/components/ContentContainer';
import { AppointmentListContainer } from '../../components/appointments/containers/AppointmentListContainer';
import { useIsMobileViewport } from '../../hooks/useIsMobileViewport';

/**
 * AppointmentListPage — /appointments route page.
 *
 * Thin composition layer mirroring PatientListPage: page-level PageHeader +
 * the list container. All orchestration (querying, search/filter/pagination,
 * drawer, dialogs) lives in AppointmentListContainer.
 */
export const AppointmentListPage: FC = () => {
  const isMobile = useIsMobileViewport();
  return (
    <ContentContainer width="wide">
      <PageWrapper>
        {!isMobile && (
          <PageHeader
            title="Appointments"
            subtitle="Search, filter and manage scheduled appointments."
          />
        )}
        <AppointmentListContainer />
      </PageWrapper>
    </ContentContainer>
  );
};
