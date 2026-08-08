import type { FC } from 'react';
import { Lock } from 'lucide-react';
import { Icon } from '../../common/Icon/Icon';

/**
 * InvoiceDetailPermission — 403 permission-denied state for the detail page.
 *
 * Shown when the backend rejects the invoice read with 403. No role names
 * are hardcoded; the copy follows the shared permission/error conventions.
 * Never auto-retried (`shouldRetryQuery`).
 */
export const InvoiceDetailPermission: FC = () => {
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
        Your account does not have access to this invoice. Ask a clinic
        administrator to update your role permissions.
      </p>
      <p className="mt-6 text-caption font-medium uppercase tracking-wide text-neutral-400">
        Error 403 · Insufficient permissions
      </p>
    </div>
  );
};
