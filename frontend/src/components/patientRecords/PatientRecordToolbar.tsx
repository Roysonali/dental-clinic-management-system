import type { FC } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '../common/Button/Button';
import { SearchBar } from '../common/SearchBar/SearchBar';
import { Select } from '../common/Input/Select';
import { Icon } from '../common/Icon/Icon';
import { PATIENT_RECORD_STATUS_FILTERS } from '../../constants/patientRecord';
import type {
  FinalizedFilter,
  PatientRecordStatusFilter,
} from '../../hooks/patientRecords/usePatientRecordFilters';

interface PatientRecordToolbarProps {
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
 * PatientRecordToolbar — list page search + filters + New Record button
 * ([UI spec S-01]). Every control maps to a SERVER-SIDE query param via the
 * filters hook. The search placeholder states the backend scope: chief
 * complaint + clinical notes only (BCR O12).
 */
export const PatientRecordToolbar: FC<PatientRecordToolbarProps> = ({
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
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="w-full lg:max-w-md">
          <SearchBar
            value={searchValue}
            onChange={onSearchChange}
            placeholder="Search by chief complaint or clinical notes…"
            loading={searchLoading}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              leftIcon={<Icon icon={X} size="xs" />}
            >
              Clear filters
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={onCreate}
            leftIcon={<Icon icon={Plus} size="xs" />}
          >
            New Record
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-44">
          <Select
            label="Status"
            options={PATIENT_RECORD_STATUS_FILTERS}
            value={status}
            onChange={(e) => onStatusChange(e.target.value as PatientRecordStatusFilter)}
          />
        </div>
        <div className="w-44">
          <Select
            label="Finalized"
            options={[
              { value: 'all', label: 'All' },
              { value: 'finalized', label: 'Finalized' },
              { value: 'not-finalized', label: 'Not finalized' },
            ]}
            value={finalized}
            onChange={(e) => onFinalizedChange(e.target.value as FinalizedFilter)}
          />
        </div>
      </div>
    </div>
  );
};
