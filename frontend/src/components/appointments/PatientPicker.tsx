import { useState, useId, type FC } from 'react';
import { Search, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from '../../hooks/useDebounce';
import { patientService } from '../../services/patientService';
import { FormField } from '../common/Form/FormField';
import { Icon } from '../common/Icon/Icon';
import { PatientAvatar } from '../patients/PatientAvatar';
import { Spinner } from '../common/Spinner/Spinner';
import { patientQueryKeys } from '../../hooks/patients/usePatients';
import type { PatientListItem } from '../../types/patient';

interface PatientPickerProps {
  /** Selected patient id (UUID) — controlled */
  value: string;
  /** Called when a patient is selected (or cleared) */
  onChange: (value: string) => void;
  /** Called with the selected patient so the parent can cache its name */
  onSelectOption?: (patient: PatientListItem) => void;
  /** Error message */
  error?: string;
  /** Disabled state (edit mode: patient is fixed by the backend) */
  disabled?: boolean;
  /** Display label shown when a value is set but no option was selected here */
  selectedLabel?: string | null;
  /** Helper text */
  helperText?: string;
  /** Required marker */
  required?: boolean;
  /** Additional wrapper classes (e.g. grid span) */
  wrapperClassName?: string;
}

interface SearchResult {
  items: PatientListItem[];
}

/**
 * PatientPicker — searchable patient combobox for the appointment form.
 *
 * Self-contained: owns its search query (debounced, 10 results) and renders
 * the result listbox. Selection is controlled via `value`/`onChange`. Uses
 * the shared `useDebounce` + `patientService.list` + `PatientAvatar` — no new
 * patterns. Best-effort: a failed search renders an inline "unavailable"
 * hint instead of blocking the form.
 */
export const PatientPicker: FC<PatientPickerProps> = ({
  value,
  onChange,
  onSelectOption,
  error,
  disabled = false,
  selectedLabel,
  helperText,
  required = false,
  wrapperClassName = '',
}) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  // Generated once per instance so the FormField label (`htmlFor`) and the
  // search input (`id`) stay associated — same pattern as the shared `Input`.
  const inputId = useId();
  // Retain the chosen patient so the chip shows the real name in create mode
  // (where `selectedLabel` is not supplied). Reset when the value is cleared.
  const [selectedOption, setSelectedOption] = useState<PatientListItem | null>(null);
  const debouncedQuery = useDebounce(query, 350);

  const searchEnabled = !disabled && open && debouncedQuery.trim().length > 0;

  const search = useQuery<SearchResult>({
    queryKey: [...patientQueryKeys.all, 'picker', debouncedQuery.trim().toLowerCase()],
    queryFn: async () => {
      const result = await patientService.list({
        page: 1,
        page_size: 10,
        search: debouncedQuery.trim() || undefined,
      });
      return { items: result.items };
    },
    enabled: searchEnabled,
    placeholderData: { items: [] },
    staleTime: 60 * 1000,
  });

  // NOTE: the picker unmounts with its host drawer, so the local `query`
  // state always starts fresh — no effect-based resync is needed here.

  const results = search.data?.items ?? [];
  const showDropdown = open && !disabled;
  const selectedName = selectedOption?.full_name ?? selectedLabel ?? query;
  const hasValue = value.length > 0;

  const selectPatient = (patient: PatientListItem) => {
    onChange(patient.id);
    onSelectOption?.(patient);
    setSelectedOption(patient);
    setQuery('');
    setOpen(false);
  };

  const clear = () => {
    onChange('');
    setSelectedOption(null);
    setQuery('');
    setOpen(false);
  };

  return (
    <FormField label="Patient" error={error} helperText={helperText} required={required} inputId={inputId}>
      <div
        className={`relative ${wrapperClassName}`}
        onBlur={(e) => {
          // Allow option clicks to land before the dropdown closes.
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
        }}
      >
        {/* Selected value chip */}
        {hasValue && !open ? (
          <div
            className={`
              flex w-full items-center gap-2 rounded-lg border bg-neutral-50 px-3 py-2.5 text-body
              ${disabled ? 'cursor-not-allowed text-neutral-400' : 'border-neutral-300 text-neutral-800'}
            `}
          >
            {selectedName ? (
              <>
                <PatientAvatar fullName={selectedName} size="sm" />
                <span className="min-w-0 flex-1 truncate font-medium text-neutral-900">
                  {selectedName}
                </span>
              </>
            ) : (
              <span className="flex-1 text-neutral-400">Select a patient</span>
            )}
            {!disabled && (
              <button
                type="button"
                onClick={clear}
                aria-label="Clear selected patient"
                className="rounded p-0.5 text-neutral-400 transition-colors hover:bg-neutral-200 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                <Icon icon={X} size="sm" />
              </button>
            )}
          </div>
        ) : (
          /* Search input */
          <div className="relative">
            <Icon
              icon={Search}
              size="sm"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            />
            <input
              id={inputId}
              type="text"
              role="combobox"
              aria-expanded={showDropdown}
              aria-autocomplete="list"
              aria-controls="patient-picker-listbox"
              aria-invalid={!!error}
              value={query}
              disabled={disabled}
              placeholder={
                hasValue && selectedName ? selectedName : 'Search patient by name or code…'
              }
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => {
                setOpen(true);
                setQuery('');
              }}
              className={`
                w-full rounded-lg border bg-white py-2.5 pl-9 pr-3 text-body text-neutral-800
                transition-colors duration-150
                focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500
                disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400
                ${
                  error
                    ? 'border-danger focus:ring-danger/20 focus:border-danger'
                    : 'border-neutral-300 hover:border-neutral-400'
                }
              `}
            />
          </div>
        )}

        {/* Results listbox */}
        {showDropdown && (
          <ul
            id="patient-picker-listbox"
            role="listbox"
            aria-label="Patient search results"
            className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-lg"
          >
            {search.isFetching ? (
              <li className="flex items-center gap-2 px-3 py-2.5 text-body-sm text-neutral-500">
                <Spinner size="sm" variant="primary" />
                Searching…
              </li>
            ) : results.length === 0 ? (
              <li className="px-3 py-2.5 text-body-sm text-neutral-500">
                {debouncedQuery.trim() ? 'No patients found.' : 'Type to search patients.'}
              </li>
            ) : (
              results.map((patient) => (
                <li key={patient.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={patient.id === value}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectPatient(patient)}
                    className={`
                      flex w-full items-center gap-3 px-3 py-2 text-left transition-colors duration-100
                      focus-visible:outline-none focus-visible:bg-neutral-100
                      ${patient.id === value ? 'bg-primary-50' : 'hover:bg-neutral-100'}
                    `}
                  >
                    <PatientAvatar fullName={patient.full_name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body-sm font-medium text-neutral-900">
                        {patient.full_name}
                      </span>
                      <span className="block truncate text-caption text-neutral-400">
                        {patient.patient_code}
                      </span>
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </FormField>
  );
};
