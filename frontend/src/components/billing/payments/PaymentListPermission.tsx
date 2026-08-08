import type { FC } from 'react';
import { Lock } from 'lucide-react';
import { Icon } from '../../common/Icon/Icon';

/**
 * PaymentListPermission — 403 permission-denied state for the payment list.
 *
 * Shown when the backend rejects the payment list read with 403 (the client
 * cannot resolve non-admin roles, so the backend is the authority). No role
 * names are hardcoded. The container never auto-retries a 403
 * (`shouldRetryQuery`), so this screen does not hammer the endpoint.
 */
export const PaymentListPermission: FC = () => {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl border border-neutral-200 bg-white px-6 py-16 text-center shadow-sm"
      role="status"
    >
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-neutral-100 bg-neutral-50 shadow-sm">
        <Icon icon={Lock} size="xl" className="text-neutral-400" />
      </div>
      <h2 className="text-h2 font-semibold text-neutral-900">You don't have permission</h2>
      <p className="mt-2 max-w-md text-body text-neutral-500">
        Your account does not have access to payment records. Ask a clinic
        administrator to update your role permissions.
      </p>
      <p className="mt-6 text-caption font-medium uppercase tracking-wide text-neutral-400">
        Error 403 · Insufficient permissions
      </p>
    </div>
  );
};
