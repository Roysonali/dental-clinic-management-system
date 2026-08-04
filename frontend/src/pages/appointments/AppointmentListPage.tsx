import type { FC } from 'react';
import { PageHeader } from '../../components/common/PageHeader/PageHeader';
import { PageWrapper } from '../../layouts/components/PageWrapper';
import { ContentContainer } from '../../layouts/components/ContentContainer';
import { AppointmentListContainer } from '../../components/appointments/containers/AppointmentListContainer';

/**
 * AppointmentListPage — /appointments route page.
 *
 * Thin composition layer mirroring PatientListPage: page-level PageHeader +
 * the list container. All orchestration (querying, search/filter/pagination,
 * drawer, dialogs) lives in AppointmentListContainer.
 */
export const AppointmentListPage: FC = () => {
  return (
    <ContentContainer width="wide">
      <PageWrapper>
        <PageHeader
          title="Appointments"
          subtitle="Search, filter and manage scheduled appointments."
        />
        <AppointmentListContainer />
      </PageWrapper>
    </ContentContainer>
  );
};
