import type { FC } from 'react';
import { useParams } from 'react-router-dom';
import { PaymentDetailsContainer } from '../../components/billing/payments/containers/PaymentDetailsContainer';

/**
 * PaymentDetailsPage — /billing/payments/:paymentId route page (Sprint 14A.3).
 *
 * Thin route wrapper; the container owns loading, error, permission and the
 * lifecycle/allocation dialogs.
 */
export const PaymentDetailsPage: FC = () => {
  const { paymentId } = useParams<{ paymentId: string }>();

  if (!paymentId) return null;
  return <PaymentDetailsContainer paymentId={paymentId} />;
};
