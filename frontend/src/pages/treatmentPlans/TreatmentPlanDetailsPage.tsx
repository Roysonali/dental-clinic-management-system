import type { FC } from 'react';
import { useParams } from 'react-router-dom';
import { PageWrapper } from '../../layouts/components/PageWrapper';
import { ContentContainer } from '../../layouts/components/ContentContainer';
import { TreatmentPlanDetailsContainer } from '../../components/treatmentPlans/containers/TreatmentPlanDetailsContainer';

/**
 * TreatmentPlanDetailsPage — /treatment-plans/:planId route page (S-02).
 *
 * Thin composition layer: reads the `:planId` param and delegates to the
 * details container. 404/error/loading states are owned by the container
 * ([MAP §3.2]).
 */
export const TreatmentPlanDetailsPage: FC = () => {
  const { planId } = useParams<{ planId: string }>();

  return (
    <ContentContainer width="wide">
      <PageWrapper>
        {planId ? <TreatmentPlanDetailsContainer planId={planId} /> : null}
      </PageWrapper>
    </ContentContainer>
  );
};
