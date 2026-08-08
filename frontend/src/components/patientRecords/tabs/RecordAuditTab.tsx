import type { FC } from 'react';
import { Card } from '../../common/Card/Card';
import { Badge } from '../../common/Badge';
import { EmptyState } from '../../common/EmptyState/EmptyState';
import { auditActionLabel } from '../../../utils/patientRecordFormatting';
import { formatISODate } from '../../../utils/date';
import type { AuditNestedResponse } from '../../../types/patientRecord';

interface RecordAuditTabProps {
  /** Embedded audit entries (visible to ALL read roles in the detail payload — O4). */
  auditLogs: AuditNestedResponse[];
  /** Resolved user names keyed by int user id (fallback: "User #id"). */
  userNames: Map<number, string | null>;
}

/**
 * RecordAuditTab — S-14 audit tab ([UI spec S-14]).
 *
 * The record-detail response embeds `audit_logs[]` for EVERY read role, so
 * this tab is visible to all 6 read roles (only the standalone audit
 * endpoints are admin-only). Entries show action (prettified) · actor ·
 * time, newest first (the backend's fixed order). `old_value`/`new_value`
 * are NOT in the nested payload and are never parsed.
 */
export const RecordAuditTab: FC<RecordAuditTabProps> = ({ auditLogs, userNames }) => {
  if (auditLogs.length === 0) {
    return (
      <Card>
        <Card.Body>
          <EmptyState title="No audit activity yet" description="Changes to this record will appear here." />
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card>
      <Card.Header title="Audit Log" />
      <Card.Body>
        <ol className="flex flex-col divide-y divide-neutral-100">
          {auditLogs.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant="neutral" size="sm">
                    {auditActionLabel(entry.action)}
                  </Badge>
                  <span className="text-caption text-neutral-500">
                    {formatISODate(entry.performed_at)}
                  </span>
                </div>
                <p className="mt-1 truncate font-mono text-caption text-neutral-400">
                  {entry.action}
                </p>
              </div>
              <span className="shrink-0 text-body-sm text-neutral-600">
                {userNames.get(entry.performed_by) ?? `User #${entry.performed_by}`}
              </span>
            </li>
          ))}
        </ol>
      </Card.Body>
    </Card>
  );
};
