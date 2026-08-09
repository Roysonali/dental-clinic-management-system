import type { FC } from 'react';
import { PageHeader } from '../../components/common/PageHeader/PageHeader';
import { PageWrapper } from '../../layouts/components/PageWrapper';
import { ContentContainer } from '../../layouts/components/ContentContainer';
import { TreatmentPlanListContainer } from '../../components/treatmentPlans/containers/TreatmentPlanListContainer';
import { useIsMobileViewport } from '../../hooks/useIsMobileViewport';

/**
 * TreatmentPlanListPage — /treatment-plans route page (S-01).
 *
 * Thin composition layer: page-level PageHeader + the list container. All
 * orchestration (queries, filters, names, drawer, transitions) lives in
 * TreatmentPlanListContainer ([MAP §3.1]).
 */
export const TreatmentPlanListPage: FC = () => {
  const isMobile = useIsMobileViewport();
  return (
    <ContentContainer width="wide">
      <PageWrapper>
        {!isMobile && (
          <PageHeader
            title="Treatment Plans"
            subtitle="Search, filter and manage patient treatment plans."
          />
        )}
        <TreatmentPlanListContainer />
      </PageWrapper>
    </ContentContainer>
  );
};
