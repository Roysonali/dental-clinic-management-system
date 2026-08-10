import type { FC } from 'react';
import { Alert } from '../common/Alert/Alert';
import { Button } from '../common/Button/Button';

interface BillingDashboardErrorProps {
  /** Invalidates/refetches the dashboard query (no full page reload). */
  onRetry: () => void;
}

/**
 * BillingDashboardError — prominent error banner for the dashboard.
 *
 * Rendered near the top when the billing service fails. Raw backend
 * exception messages are never exposed (the container passes parsed,
 * user-safe copy through). The Alert carries `role="alert"` + assertive
 * `aria-live` for screen readers, and the Retry action is a standard
 * keyboard-accessible button.
 *
 * The KPI grid below is rendered separately in "unavailable" mode by the
 * container so metrics degrade to "— / Unavailable" instead of stale data.
 */
export const BillingDashboardError: FC<BillingDashboardErrorProps> = ({
  onRetry,
}) => {
  return (
    <Alert
      variant="danger"
      title="Couldn't load billing dashboard"
      description="The billing service didn't respond. Your data is safe — try loading the dashboard again."
      actions={
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Retry
        </Button>
      }
    />
  );
};
