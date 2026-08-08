import type { FC } from 'react';
import { Card } from '../../common/Card/Card';
import { formatISODate, formatISODateTime } from '../../../utils/date';
import type { InvoiceRead } from '../../../types/billing';

interface InvoiceRecordInfoProps {
  invoice: InvoiceRead;
}

/**
 * InvoiceRecordInfo — compact record/audit metadata card.
 *
 * Renders only fields present in the backend aggregate: invoice date, due
 * date, created by/at, updated by/at, version and document version.
 */
export const InvoiceRecordInfo: FC<InvoiceRecordInfoProps> = ({ invoice }) => {
  const rows: { label: string; value: string }[] = [
    { label: 'Invoice date', value: formatISODate(invoice.invoice_date) },
    { label: 'Due date', value: formatISODate(invoice.due_date) },
    {
      label: 'Created by',
      value: invoice.creator?.full_name ?? `User #${invoice.created_by}`,
    },
    { label: 'Created at', value: formatISODateTime(invoice.created_at) },
    {
      label: 'Updated by',
      value: invoice.updater?.full_name ?? (invoice.updated_by ? `User #${invoice.updated_by}` : '—'),
    },
    { label: 'Updated at', value: formatISODateTime(invoice.updated_at) },
    { label: 'Version', value: String(invoice.version) },
    { label: 'Document version', value: String(invoice.doc_version) },
  ];

  return (
    <Card>
      <Card.Body>
        <h3 className="text-h4 font-semibold text-neutral-900">Record Information</h3>
        <dl className="mt-4 space-y-2.5">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3">
              <dt className="text-body-sm text-neutral-500">{row.label}</dt>
              <dd className="text-body-sm font-medium text-neutral-800">{row.value}</dd>
            </div>
          ))}
        </dl>
      </Card.Body>
    </Card>
  );
};
