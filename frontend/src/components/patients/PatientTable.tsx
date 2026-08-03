import type { FC, ReactNode } from 'react';
import { Eye, Pencil, UserCheck, UserPlus, UserX } from 'lucide-react';
import { DataTable } from '../common/DataTable/DataTable';
import { Button } from '../common/Button/Button';
import { IconButton } from '../common/Button/IconButton';
import { Icon } from '../common/Icon/Icon';
import { PatientAvatar } from './PatientAvatar';
import { PatientStatusBadge } from './PatientStatusBadge';
import { PatientToolbar } from './PatientToolbar';
import { PATIENT_GENDER_LABELS } from '../../constants/patient';
import type { PatientListItem, PatientStatusFilter } from '../../types/patient';
import type { RowKey } from '../common/DataTable';

interface PatientTableProps {
  /** Patient rows to display */
  patients: PatientListItem[];
  /** Loading state (skeleton rows) */
  loading?: boolean;
  /** Error message (error panel with retry) */
  error?: string | null;
  /** Retry callback for the error panel */
  onRetry?: () => void;
  /* ── Toolbar (search + filters + register) ── */
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchLoading?: boolean;
  status: PatientStatusFilter;
  onStatusChange: (status: PatientStatusFilter) => void;
  onRegister: () => void;
  /* ── Selection ── */
  selectable?: boolean;
  selectedKeys?: RowKey[];
  onSelectionChange?: (keys: RowKey[]) => void;
  /* ── Row actions ── */
  onView?: (patient: PatientListItem) => void;
  onEdit?: (patient: PatientListItem) => void;
  onDeactivate?: (patient: PatientListItem) => void;
  onReactivate?: (patient: PatientListItem) => void;
  /** Row actions column header (default 'Actions') */
  rowActionsHeader?: ReactNode;
  /** Click a row → navigate to details */
  onRowClick?: (patient: PatientListItem) => void;
  /** Accessible table label */
  ariaLabel?: string;
  /** Additional classes */
  className?: string;
}

/**
 * PatientTable — patient-specific DataTable.
 *
 * Reuses the generic DataTable/DataTableToolbar infrastructure: column
 * definitions, client-side sorting, row/bulk selection, column visibility,
 * loading/empty/error states, and row actions. No table logic is duplicated.
 *
 * NOTE: the backend list endpoint returns no "last visit" field (only
 * code/name/age/gender/phone/status), so the spec's Last Visit column is
 * intentionally omitted rather than inventing contract data.
 */
export const PatientTable: FC<PatientTableProps> = ({
  patients,
  loading = false,
  error = null,
  onRetry,
  searchValue,
  onSearchChange,
  searchLoading = false,
  status,
  onStatusChange,
  onRegister,
  selectable = false,
  selectedKeys,
  onSelectionChange,
  onView,
  onEdit,
  onDeactivate,
  onReactivate,
  rowActionsHeader = 'Actions',
  onRowClick,
  ariaLabel = 'Patients table',
  className = '',
}) => {
  return (
    <DataTable<PatientListItem>
      ariaLabel={ariaLabel}
      className={className}
      data={patients}
      rowKey={(patient) => patient.id}
      loading={loading}
      error={error}
      onRetry={onRetry}
      selectable={selectable}
      selectedKeys={selectedKeys}
      onSelectionChange={onSelectionChange}
      onRowClick={onRowClick}
      rowActionsHeader={rowActionsHeader}
      emptyTitle="No patients found"
      emptyDescription="Try adjusting your search or filters, or register a new patient."
      emptyAction={
        onRegister ? (
          <Button
            size="md"
            onClick={onRegister}
            leftIcon={<Icon icon={UserPlus} size="md" />}
            className="shrink-0 whitespace-nowrap"
          >
            Register Patient
          </Button>
        ) : undefined
      }
      toolbar={({ columnVisibility, setColumnVisibility }) => (
        <PatientToolbar
          searchValue={searchValue}
          onSearchChange={onSearchChange}
          searchLoading={searchLoading}
          status={status}
          onStatusChange={onStatusChange}
          onRegister={onRegister}
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={setColumnVisibility}
        />
      )}
      columns={[
        {
          key: 'patient_code',
          header: 'Patient Code',
          accessor: 'patient_code',
          sortable: true,
          hideable: true,
        },
        {
          key: 'name',
          header: 'Patient',
          render: (patient) => (
            <span className="flex items-center gap-3">
              <PatientAvatar fullName={patient.full_name} size="sm" />
              <span className="font-medium text-neutral-900">{patient.full_name}</span>
            </span>
          ),
          sortValue: (patient) => patient.full_name,
          sortable: true,
          hideable: true,
        },
        {
          key: 'age',
          header: 'Age',
          accessor: 'age',
          sortable: true,
          hideable: true,
          align: 'right',
          cellClassName: 'tabular-nums',
        },
        {
          key: 'gender',
          header: 'Gender',
          render: (patient) =>
            patient.gender ? PATIENT_GENDER_LABELS[patient.gender as keyof typeof PATIENT_GENDER_LABELS] ?? patient.gender : '—',
          hideable: true,
        },
        {
          key: 'phone',
          header: 'Phone',
          accessor: 'primary_contact_number',
          sortable: true,
          hideable: true,
        },
        {
          key: 'status',
          header: 'Status',
          render: (patient) => <PatientStatusBadge active={patient.is_active} size="sm" />,
          sortValue: (patient) => (patient.is_active ? 1 : 0),
          sortable: true,
          hideable: true,
        },
      ]}
      rowActions={(patient) => (
        <span className="inline-flex items-center justify-end gap-1">
          {onView && (
            <IconButton
              icon={<Icon icon={Eye} size="sm" />}
              aria-label={`View ${patient.full_name}`}
              size="sm"
              variant="ghost"
              onClick={() => onView(patient)}
            />
          )}
          {onEdit && (
            <IconButton
              icon={<Icon icon={Pencil} size="sm" />}
              aria-label={`Edit ${patient.full_name}`}
              size="sm"
              variant="ghost"
              onClick={() => onEdit(patient)}
            />
          )}
          {onDeactivate && patient.is_active && (
            <IconButton
              icon={<Icon icon={UserX} size="sm" />}
              aria-label={`Deactivate ${patient.full_name}`}
              size="sm"
              variant="ghost"
              onClick={() => onDeactivate(patient)}
            />
          )}
          {onReactivate && !patient.is_active && (
            <IconButton
              icon={<Icon icon={UserCheck} size="sm" />}
              aria-label={`Reactivate ${patient.full_name}`}
              size="sm"
              variant="ghost"
              onClick={() => onReactivate(patient)}
            />
          )}
        </span>
      )}
    />
  );
};
