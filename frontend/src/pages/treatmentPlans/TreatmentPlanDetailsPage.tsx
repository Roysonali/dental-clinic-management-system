import type { FC } from 'react';
import { useParams } from 'react-router-dom';
import { TreatmentPlanDetailsContainer } from '../../components/treatmentPlans/containers/TreatmentPlanDetailsContainer';

/**
 * TreatmentPlanDetailsPage — /treatment-plans/:planId route page (S-02).
 *
 * Thin route wrapper; the container owns loading, error handling, tabs,
 * edit drawer and status dialogs.
 */
export const TreatmentPlanDetailsPage: FC = () => {
  const { planId } = useParams<{ planId: string }>();

  if (!planId) return null;
  return <TreatmentPlanDetailsContainer planId={planId} />;
};
