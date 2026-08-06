import type { FC } from 'react';
import { PageWrapper } from '../../layouts/components/PageWrapper';
import { ContentContainer } from '../../layouts/components/ContentContainer';
import { DoctorListContainer } from '../../components/doctors/containers/DoctorListContainer';

/**
 * DoctorListPage — /doctors route page.
 *
 * Thin composition layer: page container + the list container. All
 * orchestration (querying, search/filter/pagination, stats, drawer,
 * dialogs) lives in DoctorListContainer.
 */
export const DoctorListPage: FC = () => {
  return (
    <ContentContainer width="wide">
      <PageWrapper>
        <DoctorListContainer />
      </PageWrapper>
    </ContentContainer>
  );
};
