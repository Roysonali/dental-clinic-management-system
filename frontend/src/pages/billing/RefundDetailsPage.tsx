import type { FC } from 'react';
import { useParams } from 'react-router-dom';
import { RefundDetailsContainer } from '../../components/billing/refunds/containers/RefundDetailsContainer';

/**
 * RefundDetailsPage — /billing/refunds/:refundId route page (Sprint 14A.5).
 *
 * Thin route wrapper; the container owns the timeline render and the
 * approve / reject / complete dialogs.
 */
export const RefundDetailsPage: FC = () => {
  const { refundId } = useParams<{ refundId: string }>();

  if (!refundId) return null;
  return <RefundDetailsContainer refundId={refundId} />;
};
