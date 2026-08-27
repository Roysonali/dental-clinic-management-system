import { useState, useId, useCallback, type FC } from 'react';
import { Search, X, ArrowLeft, Plus, AlertTriangle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '../../hooks/useDebounce';
import { patientService } from '../../services/patientService';
import { FormField } from '../common/Form/FormField';
import { Icon } from '../common/Icon/Icon';
import { PatientAvatar } from '../patients/PatientAvatar';
import { Spinner } from '../common/Spinner/Spinner';
import { patientQueryKeys } from '../../hooks/patients/usePatients';
import { PATIENT_GENDERS, PATIENT_GENDER_LABELS, PATIENT_NAME_PATTERN, PATIENT_PHONE_PATTERN } from '../../constants/patient';
import type { PatientListItem, PatientQuickCreatePayload } from '../../types/patient';

/* ── Quick-create Zod-free inline validation ─────────────────────── */

function validateQuickCreate(values: {
  first_name: string;
  last_name: string;
  primary_contact_number: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  const fn = values.first_name.trim();
  const ln = values.last_name.trim();
  const phone = values.primary_contact_number.trim();

  if (!fn) {
    errors.first_name = 'First name is required';
  } else if (fn.length < 2) {
    errors.first_name = 'First name must be at least 2 characters';
  } else if (!PATIENT_NAME_PATTERN.test(fn)) {
    errors.first_name = 'Name should contain only alphabetic characters, spaces, hyphens, and apostrophes.';
  }

  if (!ln) {
    errors.last_name = 'Last name is required';
  } else if (ln.length < 2) {
    errors.last_name = 'Last name must be at least 2 characters';
  } else if (!PATIENT_NAME_PATTERN.test(ln)) {
    errors.last_name = 'Name should contain only alphabetic characters, spaces, hyphens, and apostrophes.';
  }

  if (!phone) {
    errors.primary_contact_number = 'Phone number is required';
  } else if (!PATIENT_PHONE_PATTERN.test(phone)) {
    errors.primary_contact_number = 'Phone must be 10–15 digits with an optional leading +';
  }

  return errors;
}

/* ── Props ──────────────────────────────────────────────────────────── */

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

/* ── Component ──────────────────────────────────────────────────────── */

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
  const inputId = useId();
  const queryClient = useQueryClient();

  /* ── Search state ──────────────────────────────────── */
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState<PatientListItem | null>(null);
  const debouncedQuery = useDebounce(query, 350);

  /* ── Quick-create state ────────────────────────────── */
  type PickerMode = 'search' | 'quick-create' | 'confirming';
  const [mode, setMode] = useState<PickerMode>('search');
  const [createForm, setCreateForm] = useState({
    first_name: '',
    last_name: '',
    primary_contact_number: '',
    gender: '',
  });
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [createServerError, setCreateServerError] = useState<string | null>(null);

  /* ── T1 matches tracking (for T2 confirmation) ─────── */
  const [t1HadMatches, setT1HadMatches] = useState(false);

  /* ── T3 warnings after creation ────────────────────── */
  const [t3Warnings, setT3Warnings] = useState<string[]>([]);
  const [t3Matches, setT3Matches] = useState<PatientListItem[]>([]);

  /* ── Debounced search ──────────────────────────────── */
  const searchEnabled = !disabled && open && mode === 'search' && debouncedQuery.trim().length > 0;

  const search = useQuery<{ items: PatientListItem[] }>({
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

  const results = search.data?.items ?? [];

  const showDropdown = open && !disabled && mode === 'search';
  const selectedName = selectedOption?.full_name ?? selectedLabel ?? query;
  const hasValue = value.length > 0;

  /* ── Quick-create mutation ──────────────────────────── */
  const createMutation = useMutation({
    mutationFn: patientService.quickCreate,
    onSuccess: (data) => {
      // Invalidate patient queries so the list refreshes
      void queryClient.invalidateQueries({ queryKey: patientQueryKeys.all });

      // Auto-select the newly created patient
      onChange(data.patient.id);
      setSelectedOption({
        id: data.patient.id,
        patient_code: data.patient.patient_code,
        full_name: data.patient.full_name,
        age: data.patient.age,
        gender: data.patient.gender,
        primary_contact_number: data.patient.primary_contact_number,
        is_active: data.patient.is_active,
        profile_status: data.patient.profile_status,
      });
      onSelectOption?.({
        id: data.patient.id,
        patient_code: data.patient.patient_code,
        full_name: data.patient.full_name,
        age: data.patient.age,
        gender: data.patient.gender,
        primary_contact_number: data.patient.primary_contact_number,
        is_active: data.patient.is_active,
        profile_status: data.patient.profile_status,
      });

      // Show T3 warnings if any
      setT3Warnings(data.warnings);
      setT3Matches(data.potential_matches);

      // Reset create form and mode
      setMode('search');
      setCreateForm({ first_name: '', last_name: '', primary_contact_number: '', gender: '' });
      setCreateErrors({});
      setCreateServerError(null);
      setQuery('');
      setOpen(false);
    },
    onError: () => {
      setCreateServerError('Failed to create patient. Please try again.');
    },
  });

  /* ── Handlers ───────────────────────────────────────── */

  const selectPatient = (patient: PatientListItem) => {
    onChange(patient.id);
    onSelectOption?.(patient);
    setSelectedOption(patient);
    setQuery('');
    setOpen(false);
    setMode('search');
    setT3Warnings([]);
    setT3Matches([]);
  };

  const clear = () => {
    onChange('');
    setSelectedOption(null);
    setQuery('');
    setOpen(false);
    setMode('search');
    setT1HadMatches(false);
    setT3Warnings([]);
    setT3Matches([]);
    setCreateForm({ first_name: '', last_name: '', primary_contact_number: '', gender: '' });
  };

  const openQuickCreate = useCallback(() => {
    // Pre-fill phone from search query
    setCreateForm((prev) => ({
      ...prev,
      primary_contact_number: prev.primary_contact_number || debouncedQuery.trim(),
    }));
    // Track whether T1 had matches for T2 confirmation
    setT1HadMatches(results.length > 0);
    setMode('quick-create');
    setCreateErrors({});
    setCreateServerError(null);
  }, [debouncedQuery, results.length]);

  const handleCreateSubmit = useCallback(() => {
    const errors = validateQuickCreate(createForm);
    setCreateErrors(errors);
    if (Object.keys(errors).length > 0) return;

    // T2: If T1 found matches, require confirmation before proceeding
    if (t1HadMatches) {
      setMode('confirming');
      return;
    }

    // No T1 matches — proceed directly
    createMutation.mutate({
      first_name: createForm.first_name.trim(),
      last_name: createForm.last_name.trim(),
      primary_contact_number: createForm.primary_contact_number.trim(),
      gender: (createForm.gender as PatientQuickCreatePayload['gender']) || undefined,
    });
  }, [createForm, t1HadMatches, createMutation]);

  const handleConfirmCreate = useCallback(() => {
    createMutation.mutate({
      first_name: createForm.first_name.trim(),
      last_name: createForm.last_name.trim(),
      primary_contact_number: createForm.primary_contact_number.trim(),
      gender: (createForm.gender as PatientQuickCreatePayload['gender']) || undefined,
    });
  }, [createForm, createMutation]);

  const handleBackToSearch = () => {
    setMode('search');
    setCreateErrors({});
    setCreateServerError(null);
  };

  const dismissWarnings = () => {
    setT3Warnings([]);
    setT3Matches([]);
  };

  /* ── Render ─────────────────────────────────────────── */

  const genderOptions = PATIENT_GENDERS.map((g) => ({
    value: g,
    label: PATIENT_GENDER_LABELS[g],
  }));

  return (
    <FormField label="Patient" error={error} helperText={helperText} required={required} inputId={inputId}>
      <div
        className={`relative ${wrapperClassName}`}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
        }}
      >
        {/* ── T3 warnings banner ──────────────────────────── */}
        {t3Warnings.length > 0 && (
          <div className="mb-2 rounded-lg border border-warning/30 bg-warning/10 p-3">
            <div className="flex items-start gap-2">
              <Icon icon={AlertTriangle} size="sm" className="mt-0.5 text-warning" />
              <div className="min-w-0 flex-1">
                <p className="text-body-sm font-medium text-warning">Potential matches found</p>
                {t3Matches.map((m) => (
                  <p key={m.id} className="text-caption text-neutral-600">
                    {m.full_name} ({m.patient_code})
                  </p>
                ))}
                <p className="text-caption text-neutral-500">{t3Warnings[0]}</p>
              </div>
              <button
                type="button"
                onClick={dismissWarnings}
                className="rounded p-0.5 text-neutral-400 hover:text-neutral-700"
                aria-label="Dismiss warnings"
              >
                <Icon icon={X} size="sm" />
              </button>
            </div>
          </div>
        )}

        {/* ── Selected value chip ──────────────────────────── */}
        {hasValue && !open && mode === 'search' ? (
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
                {selectedOption?.profile_status === 'incomplete' && (
                  <span className="shrink-0 rounded bg-warning/15 px-1.5 py-0.5 text-caption font-medium text-warning">
                    Incomplete
                  </span>
                )}
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
        ) : mode === 'quick-create' || mode === 'confirming' ? (
          /* ── Quick-create form ──────────────────────────── */
          <div className="rounded-lg border border-neutral-300 bg-white p-3">
            <div className="mb-2 flex items-center gap-2">
              <button
                type="button"
                onClick={handleBackToSearch}
                className="rounded p-0.5 text-neutral-400 transition-colors hover:text-neutral-700"
                aria-label="Back to search"
              >
                <Icon icon={ArrowLeft} size="sm" />
              </button>
              <span className="text-body-sm font-medium text-neutral-700">Quick Patient Registration</span>
            </div>

            {createServerError && (
              <div role="alert" className="mb-2 rounded border border-danger/25 bg-danger/10 p-2">
                <p className="text-caption text-danger">{createServerError}</p>
              </div>
            )}

            {/* T2 confirmation dialog */}
            {mode === 'confirming' && (
              <div className="mb-3 rounded-lg border border-warning/30 bg-warning/5 p-3">
                <p className="mb-1 text-body-sm font-medium text-neutral-800">Potential Duplicates Found</p>
                <p className="mb-2 text-caption text-neutral-600">
                  Patients matching your search already exist. Are you sure you want to create a new patient?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleBackToSearch}
                    className="rounded-lg border border-neutral-300 px-3 py-1.5 text-caption font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('search');
                      setQuery('');
                      setOpen(true);
                    }}
                    className="rounded-lg border border-primary-300 bg-primary-50 px-3 py-1.5 text-caption font-medium text-primary-700 transition-colors hover:bg-primary-100"
                  >
                    Select Existing
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmCreate}
                    disabled={createMutation.isPending}
                    className="rounded-lg bg-primary-500 px-3 py-1.5 text-caption font-medium text-white transition-colors hover:bg-primary-600 disabled:opacity-50"
                  >
                    {createMutation.isPending ? 'Creating…' : 'Create Anyway'}
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor={`${inputId}-fn`} className="mb-0.5 block text-caption font-medium text-neutral-700">
                  First Name *
                </label>
                <input
                  id={`${inputId}-fn`}
                  type="text"
                  value={createForm.first_name}
                  onChange={(e) => setCreateForm((p) => ({ ...p, first_name: e.target.value }))}
                  className={`w-full rounded-lg border px-2.5 py-1.5 text-body-sm ${
                    createErrors.first_name ? 'border-danger' : 'border-neutral-300'
                  }`}
                  placeholder="Abc"
                  autoFocus
                />
                {createErrors.first_name && (
                  <p className="mt-0.5 text-caption text-danger">{createErrors.first_name}</p>
                )}
              </div>
              <div>
                <label htmlFor={`${inputId}-ln`} className="mb-0.5 block text-caption font-medium text-neutral-700">
                  Last Name *
                </label>
                <input
                  id={`${inputId}-ln`}
                  type="text"
                  value={createForm.last_name}
                  onChange={(e) => setCreateForm((p) => ({ ...p, last_name: e.target.value }))}
                  className={`w-full rounded-lg border px-2.5 py-1.5 text-body-sm ${
                    createErrors.last_name ? 'border-danger' : 'border-neutral-300'
                  }`}
                  placeholder="Dhf"
                />
                {createErrors.last_name && (
                  <p className="mt-0.5 text-caption text-danger">{createErrors.last_name}</p>
                )}
              </div>
              <div>
                <label htmlFor={`${inputId}-phone`} className="mb-0.5 block text-caption font-medium text-neutral-700">
                  Phone *
                </label>
                <input
                  id={`${inputId}-phone`}
                  type="tel"
                  value={createForm.primary_contact_number}
                  onChange={(e) => setCreateForm((p) => ({ ...p, primary_contact_number: e.target.value }))}
                  className={`w-full rounded-lg border px-2.5 py-1.5 text-body-sm ${
                    createErrors.primary_contact_number ? 'border-danger' : 'border-neutral-300'
                  }`}
                  placeholder="+639123456789"
                />
                {createErrors.primary_contact_number && (
                  <p className="mt-0.5 text-caption text-danger">{createErrors.primary_contact_number}</p>
                )}
              </div>
              <div>
                <label htmlFor={`${inputId}-gender`} className="mb-0.5 block text-caption font-medium text-neutral-700">
                  Gender
                </label>
                <select
                  id={`${inputId}-gender`}
                  value={createForm.gender}
                  onChange={(e) => setCreateForm((p) => ({ ...p, gender: e.target.value }))}
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-body-sm"
                >
                  <option value="">Optional</option>
                  {genderOptions.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleBackToSearch}
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-caption font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateSubmit}
                disabled={createMutation.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-primary-500 px-3 py-1.5 text-caption font-medium text-white transition-colors hover:bg-primary-600 disabled:opacity-50"
              >
                {createMutation.isPending ? (
                  <>
                    <Spinner size="sm" variant="white" />
                    Creating…
                  </>
                ) : (
                  'Create & Continue'
                )}
              </button>
            </div>
          </div>
        ) : (
          /* ── Search input ──────────────────────────────── */
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
                hasValue && selectedName ? selectedName : 'Search patient by name or phone…'
              }
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
                setMode('search');
              }}
              onFocus={() => {
                setOpen(true);
                setMode('search');
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

        {/* ── Results listbox ────────────────────────────── */}
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
            ) : results.length === 0 && debouncedQuery.trim() ? (
              <>
                <li className="px-3 py-2.5 text-body-sm text-neutral-500">No patients found.</li>
                <li>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setCreateForm((p) => ({ ...p, primary_contact_number: debouncedQuery.trim() }));
                      openQuickCreate();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-body-sm font-medium text-primary-600 transition-colors hover:bg-primary-50 focus-visible:outline-none focus-visible:bg-primary-50"
                  >
                    <Icon icon={Plus} size="sm" />
                    Create New Patient
                  </button>
                </li>
              </>
            ) : !debouncedQuery.trim() ? (
              <li className="px-3 py-2.5 text-body-sm text-neutral-500">Type to search patients.</li>
            ) : (
              <>
                {results.map((patient) => (
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
                ))}
                {/* T1: "+ Create New Patient" button always shown when search has results */}
                <li className="border-t border-neutral-100">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setCreateForm((p) => ({ ...p, primary_contact_number: debouncedQuery.trim() }));
                      openQuickCreate();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-body-sm font-medium text-primary-600 transition-colors hover:bg-primary-50 focus-visible:outline-none focus-visible:bg-primary-50"
                  >
                    <Icon icon={Plus} size="sm" />
                    Create New Patient
                  </button>
                </li>
              </>
            )}
          </ul>
        )}
      </div>
    </FormField>
  );
};
