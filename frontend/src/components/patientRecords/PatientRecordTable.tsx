import type { FC } from 'react';
import { DataTable, type DataTableColumn } from '../common/DataTable';
import { Button } from '../common/Button/Button';
import { PatientRecordStatusBadge } from './PatientRecordStatusBadge';
import { PatientRecordToolbar } from './PatientRecordToolbar';
import { formatISODate } from '../../utils/date';
import type { EnrichedPatientRecord } from '../../types/patientRecord';
import type { FinalizedFilter, PatientRecordStatusFilter } from '../../hooks/patientRecords/usePatientRecordFilters';

interface PatientRecordTableProps {
  records: EnrichedPatientRecord[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onView: (record: EnrichedPatientRecord) => void;
  onRowClick: (record: EnrichedPatientRecord) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchLoading?: boolean;
  status: PatientRecordStatusFilter;
  onStatusChange: (value: PatientRecordStatusFilter) => void;
  finalized: FinalizedFilter;
  onFinalizedChange: (value: FinalizedFilter) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onCreate: () => void;
}

/**
 * PatientRecordTable — list page table ([UI spec S-01]).
 *
 * Columns (priority order): Patient (resolved name) · Status · Chief
 * complaint · Finalized indicator · Appointment (resolved) · Created.
 * No sortable columns — the backend exposes no sort parameters (fixed
 * `created_at DESC`).
 */
export const PatientRecordTable: FC<PatientRecordTableProps> = ({
  records,
  loading = false,
  error = null,
  onRetry,
  onView,
  onRowClick,
  searchValue,
  onSearchChange,
  searchLoading = false,
  status,
  onStatusChange,
  finalized,
  onFinalizedChange,
  hasActiveFilters,
  onClearFilters,
  onCreate,
}) => {
  const columns: DataTableColumn<EnrichedPatientRecord>[] = [
    {
      key: 'patient',
      header: 'Patient',
      render: (record) => (
        <span className="font-medium text-neutral-900">
          {record.patient_name ?? `Patient #${record.patient_id.slice(0, 8)}`}
        </span>
      ),
      hideable: true,
      defaultHidden: false,
    },
    {
      key: 'status',
      header: 'Status',
      render: (record) => (
        <PatientRecordStatusBadge status={record.status} isFinalized={record.is_finalized} />
      ),
      hideable: false,
    },
    {
      key: 'chief_complaint',
      header: 'Chief Complaint',
      render: (record) => (
        <span className="block max-w-[280px] truncate text-neutral-700" title={record.chief_complaint ?? ''}>
          {record.chief_complaint || '—'}
        </span>
      ),
      hideable: true,
      defaultHidden: false,
    },
    {
      key: 'finalized',
      header: 'Finalized',
      render: (record) => (
        <span className={record.is_finalized ? 'text-neutral-900' : 'text-neutral-400'}>
          {record.is_finalized ? 'Yes' : 'No'}
        </span>
      ),
      hideable: true,
      defaultHidden: true,
    },
    {
      key: 'appointment',
      header: 'Appointment',
      render: (record) => (
        <span className="font-mono text-caption text-neutral-600">
          {record.has_appointment
            ? (record.appointment_number ?? `APT #${record.appointment_id?.slice(0, 8)}`)
            : '—'}
        </span>
      ),
      hideable: true,
      defaultHidden: true,
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (record) => <span className="text-neutral-600">{formatISODate(record.created_at)}</span>,
      hideable: true,
      defaultHidden: true,
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={records}
      rowKey={(record) => record.id}
      loading={loading}
      error={error}
      onRetry={onRetry}
      zebra
      ariaLabel="Patient records"
      emptyTitle="No patient records yet"
      emptyDescription="Clinical charts appear here once a record is created."
      rowActionsHeader=""
      rowActions={(record) => (
        <Button variant="ghost" size="sm" onClick={() => onView(record)}>
          View
        </Button>
      )}
      onRowClick={onRowClick}
      toolbar={() => (
        <PatientRecordToolbar
          searchValue={searchValue}
          onSearchChange={onSearchChange}
          searchLoading={searchLoading}
          status={status}
          onStatusChange={onStatusChange}
          finalized={finalized}
          onFinalizedChange={onFinalizedChange}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={onClearFilters}
          onCreate={onCreate}
        />
      )}
    />
  );
};
