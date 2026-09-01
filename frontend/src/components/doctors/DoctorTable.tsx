import type { FC, ReactNode } from 'react';
import { Eye, Pencil, UserCheck, UserX } from 'lucide-react';
import { DataTable } from '../common/DataTable/DataTable';
import { IconButton } from '../common/Button/IconButton';
import { Icon } from '../common/Icon/Icon';
import { Tooltip } from '../common/Tooltip/Tooltip';
import { Badge } from '../common/Badge/Badge';
import { StatusBadge } from '../common/StatusBadge/StatusBadge';
import { Skeleton } from '../common/Skeleton/Skeleton';
import { EmptyState } from '../common/EmptyState/EmptyState';
import { ResultState } from '../common/ResultState/ResultState';
import { Button } from '../common/Button/Button';
import { DoctorAvatar } from './DoctorAvatar';
import { DoctorStatusBadge } from './DoctorStatusBadge';
import { DOCTOR_CURRENCY_CODE } from '../../constants/doctor';
import { formatCurrency } from '../../utils/formatting';
import { useIsNarrowViewport } from '../../hooks/useIsNarrowViewport';
import type { ColumnVisibility } from '../common/DataTable';
import type { DoctorResponse } from '../../types/doctor';

/* ── Display helpers ─────────────────────────────────────────────────── */

function primarySpecializationName(doctor: DoctorResponse): string {
  const primary = doctor.specializations.find((s) => s.is_primary);
  return primary?.specialization_name ?? doctor.specializations[0]?.specialization_name ?? null;
}

/** Availability badge (computed from backend flags; available = is_active AND flag AND NOT on_leave). */
function AvailabilityBadge({ doctor }: { doctor: DoctorResponse }) {
  const available = doctor.is_active && doctor.available_for_appointment && !doctor.on_leave;
  return (
    <StatusBadge
      status={available ? 'available' : 'unavailable'}
      label={available ? 'Available' : 'Unavailable'}
      statusMap={{ available: 'success', unavailable: 'neutral' }}
      size="sm"
      showDot
    />
  );
}

function displayName(doctor: DoctorResponse): string {
  return doctor.user_full_name ?? `Doctor #${doctor.user_id}`;
}

/* ── Mobile card (table collapses to a card stack < 1024px) ──────────── */

function DoctorCard({
  doctor,
  onRowClick,
  onEdit,
  onDeactivate,
  onReactivate,
}: {
  doctor: DoctorResponse;
  onRowClick?: (doctor: DoctorResponse) => void;
  onEdit?: (doctor: DoctorResponse) => void;
  onDeactivate?: (doctor: DoctorResponse) => void;
  onReactivate?: (doctor: DoctorResponse) => void;
}) {
  const name = displayName(doctor);

  return (
    <article className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <DoctorAvatar fullName={doctor.user_full_name} src={doctor.profile_photo_url} size="lg" />
          <div className="min-w-0">
            <p className="truncate font-semibold text-neutral-900">{onRowClick ? (
              <button
                type="button"
                onClick={() => onRowClick(doctor)}
                className="cursor-pointer text-left text-inherit underline decoration-transparent transition-colors hover:text-primary-600 hover:decoration-primary-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/20"
              >
                {name}
              </button>
            ) : name}</p>
            <p className="truncate text-caption text-neutral-500">{doctor.doctor_code}</p>
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-0.5">
          {onEdit && (
            <Tooltip content="Edit">
              <IconButton
                icon={<Icon icon={Pencil} size="sm" />}
                aria-label={`Edit ${name}`}
                size="sm"
                variant="ghost"
                onClick={() => onEdit(doctor)}
              />
            </Tooltip>
          )}
          {onDeactivate && doctor.is_active && (
            <Tooltip content="Deactivate">
              <IconButton
                icon={<Icon icon={UserX} size="sm" />}
                aria-label={`Deactivate ${name}`}
                size="sm"
                variant="ghost"
                onClick={() => onDeactivate(doctor)}
              />
            </Tooltip>
          )}
          {onReactivate && !doctor.is_active && (
            <Tooltip content="Reactivate">
              <IconButton
                icon={<Icon icon={UserCheck} size="sm" />}
                aria-label={`Reactivate ${name}`}
                size="sm"
                variant="ghost"
                onClick={() => onReactivate(doctor)}
              />
            </Tooltip>
          )}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <DoctorStatusBadge active={doctor.is_active} size="sm" />
        <AvailabilityBadge doctor={doctor} />
        {primarySpecializationName(doctor) && (
          <Badge variant="secondary" size="sm">
            {primarySpecializationName(doctor)}
          </Badge>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-neutral-100 pt-4 text-body-sm">
        <div className="min-w-0">
          <dt className="text-caption text-neutral-400">Consultation Fee</dt>
          <dd className="font-medium tabular-nums text-neutral-800">{formatCurrency(doctor.consultation_fee, DOCTOR_CURRENCY_CODE)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-caption text-neutral-400">Experience</dt>
          <dd className="font-medium text-neutral-800">
            {doctor.years_of_experience == null ? '—' : `${doctor.years_of_experience} yrs`}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-caption text-neutral-400">Phone</dt>
          <dd className="truncate font-medium text-neutral-800">{doctor.primary_phone ?? '—'}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-caption text-neutral-400">Email</dt>
          <dd className="truncate font-medium text-neutral-800">{doctor.user_email ?? '—'}</dd>
        </div>
      </dl>
    </article>
  );
}

function DoctorCardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="Loading doctors">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <Skeleton variant="avatar" />
            <div className="flex-1 space-y-2">
              <Skeleton variant="text" className="w-1/2" />
              <Skeleton variant="text" className="w-1/3" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Skeleton variant="badge" className="w-20" />
            <Skeleton variant="badge" className="w-24" />
          </div>
          <div className="mt-4 space-y-2 border-t border-neutral-100 pt-4">
            <Skeleton variant="text" className="w-3/4" />
            <Skeleton variant="text" className="w-2/3" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading...</span>
    </div>
  );
}

/* ── Props ───────────────────────────────────────────────────────────── */

interface DoctorTableProps {
  /** Doctor rows to display */
  doctors: DoctorResponse[];
  /** Loading state (skeleton rows / cards) */
  loading?: boolean;
  /** Error message (error panel with retry) */
  error?: string | null;
  /** Retry callback for the error panel */
  onRetry?: () => void;
  /* ── Column visibility (owned by the page-level DoctorToolbar) ── */
  columnVisibility?: ColumnVisibility;
  onColumnVisibilityChange?: (visibility: ColumnVisibility) => void;
  /* ── Row click navigation ── */
  onRowClick?: (doctor: DoctorResponse) => void;
  /* ── Row actions ── */
  onViewDetails?: (doctor: DoctorResponse) => void;
  onEdit?: (doctor: DoctorResponse) => void;
  onDeactivate?: (doctor: DoctorResponse) => void;
  onReactivate?: (doctor: DoctorResponse) => void;
  /** Row actions column header (default 'Actions') */
  rowActionsHeader?: ReactNode;
  /** Accessible table label */
  ariaLabel?: string;
  /** Additional classes */
  className?: string;
}

/**
 * DoctorTable — doctor-specific DataTable.
 *
 * Columns map 1:1 to backend `DoctorResponse` fields (no invented
 * columns): code, name (+avatar), primary specialization, phone, years
 * of experience, consultation fee, status and availability.
 *
 * Below the `lg` breakpoint the table collapses to a stack of cards.
 *
 * NOTE: this component renders ONLY the data grid. The search/filter
 * toolbar lives at the page level (DoctorListContainer) — DataTable is
 * not handed a toolbar here so there is exactly one toolbar per page.
 */
export const DoctorTable: FC<DoctorTableProps> = ({
  doctors,
  loading = false,
  error = null,
  onRetry,
  columnVisibility,
  onColumnVisibilityChange,
  onRowClick,
  onViewDetails,
  onEdit,
  onDeactivate,
  onReactivate,
  rowActionsHeader = 'Actions',
  ariaLabel = 'Doctors table',
  className = '',
}) => {
  const isNarrow = useIsNarrowViewport();

  const rowActions = (doctor: DoctorResponse) => {
    const name = displayName(doctor);
    return (
      <span className="inline-flex items-center justify-end gap-0.5">
        {onViewDetails && (
          <Tooltip content="View Details">
            <IconButton
              icon={<Icon icon={Eye} size="sm" />}
              aria-label={`View details for ${name}`}
              size="sm"
              variant="ghost"
              onClick={() => onViewDetails(doctor)}
            />
          </Tooltip>
        )}
        {onEdit && (
          <Tooltip content="Edit">
            <IconButton
              icon={<Icon icon={Pencil} size="sm" />}
              aria-label={`Edit ${name}`}
              size="sm"
              variant="ghost"
              onClick={() => onEdit(doctor)}
            />
          </Tooltip>
        )}
        {onDeactivate && doctor.is_active && (
          <Tooltip content="Deactivate">
            <IconButton
              icon={<Icon icon={UserX} size="sm" />}
              aria-label={`Deactivate ${name}`}
              size="sm"
              variant="ghost"
              onClick={() => onDeactivate(doctor)}
            />
          </Tooltip>
        )}
        {onReactivate && !doctor.is_active && (
          <Tooltip content="Reactivate">
            <IconButton
              icon={<Icon icon={UserCheck} size="sm" />}
              aria-label={`Reactivate ${name}`}
              size="sm"
              variant="ghost"
              onClick={() => onReactivate(doctor)}
            />
          </Tooltip>
        )}
      </span>
    );
  };

  /* ── Mobile card layout ─────────────────────────────────────────── */
  if (isNarrow) {
    return (
      <div className={className}>
        {loading ? (
          <DoctorCardSkeleton count={4} />
        ) : error ? (
          <div className="rounded-xl border border-danger/20 bg-danger/5">
            <ResultState
              variant="error"
              title="Failed to load data"
              description={error}
              actions={
                onRetry ? (
                  <Button variant="primary" size="md" onClick={onRetry}>
                    Retry
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : doctors.length === 0 ? (
          <div className="rounded-xl border border-neutral-200 bg-white">
            <EmptyState
              title="No doctors found"
              description="Try adjusting your search or filters, or register a new doctor."
            />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {doctors.map((doctor) => (
              <DoctorCard
                key={doctor.id}
                doctor={doctor}
                onRowClick={onRowClick}
                onEdit={onEdit}
                onDeactivate={onDeactivate}
                onReactivate={onReactivate}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  /* ── Desktop table layout ───────────────────────────────────────── */
  return (
    <DataTable<DoctorResponse>
      ariaLabel={ariaLabel}
      className={className}
      tableClassName="min-w-[1400px]"
      data={doctors}
      rowKey={(doctor) => doctor.id}
      loading={loading}
      error={error}
      onRetry={onRetry}
      onRowClick={onRowClick}
      zebra
      rowActionsHeader={rowActionsHeader}
      emptyTitle="No doctors found"
      emptyDescription="Try adjusting your search or filters, or register a new doctor."
      columnVisibility={columnVisibility}
      onColumnVisibilityChange={onColumnVisibilityChange}
      columns={[
        {
          key: 'doctor_code',
          header: 'Doctor Code',
          accessor: 'doctor_code',
          sortable: true,
          hideable: true,
          cellClassName: 'font-medium text-neutral-500 tabular-nums',
        },
        {
          key: 'name',
          header: 'Doctor',
          render: (doctor) => (
            <span className="flex items-center gap-3">
              <DoctorAvatar fullName={doctor.user_full_name} src={doctor.profile_photo_url} size="md" />
              <span className="min-w-0">
                <span className="block truncate font-medium text-neutral-900">
                  {displayName(doctor)}
                </span>
                {doctor.user_email && (
                  <span className="block truncate text-caption text-neutral-400">{doctor.user_email}</span>
                )}
              </span>
            </span>
          ),
          sortValue: (doctor) => doctor.user_full_name ?? '',
          sortable: true,
          hideable: true,
        },
        {
          key: 'primary_specialization',
          header: 'Primary Specialization',
          render: (doctor) => primarySpecializationName(doctor) ?? '—',
          hideable: true,
        },
        {
          key: 'primary_phone',
          header: 'Primary Phone',
          accessor: 'primary_phone',
          sortable: true,
          hideable: true,
        },
        {
          key: 'years_of_experience',
          header: 'Years of Experience',
          render: (doctor) => (doctor.years_of_experience == null ? '—' : String(doctor.years_of_experience)),
          sortValue: (doctor) => doctor.years_of_experience ?? 0,
          sortable: true,
          hideable: true,
          align: 'right',
          cellClassName: 'tabular-nums',
        },
        {
          key: 'consultation_fee',
          header: 'Consultation Fee',
          render: (doctor) => formatCurrency(doctor.consultation_fee, DOCTOR_CURRENCY_CODE),
          sortValue: (doctor) => doctor.consultation_fee ?? 0,
          sortable: true,
          hideable: true,
          align: 'right',
          cellClassName: 'tabular-nums',
        },
        {
          key: 'status',
          header: 'Status',
          render: (doctor) => <DoctorStatusBadge active={doctor.is_active} size="sm" />,
          sortValue: (doctor) => (doctor.is_active ? 1 : 0),
          sortable: true,
          hideable: true,
        },
        {
          key: 'availability',
          header: 'Availability',
          render: (doctor) => <AvailabilityBadge doctor={doctor} />,
          hideable: true,
        },
      ]}
      rowActions={rowActions}
    />
  );
};
