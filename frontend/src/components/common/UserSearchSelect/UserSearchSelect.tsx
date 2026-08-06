import { useState, useId, type FC, type KeyboardEvent } from 'react';
import { Search, X, RotateCw } from 'lucide-react';
import { FormField } from '../Form/FormField';
import { Icon } from '../Icon/Icon';
import { Spinner } from '../Spinner/Spinner';
import { Avatar } from '../Avatar/Avatar';
import { Button } from '../Button/Button';
import { useUsersSearch } from '../../../hooks/users/useUsersSearch';
import { getInitials } from '../../../utils/formatting';
import type { UserListItem } from '../../../types/user';

/* ── Props ───────────────────────────────────────────────────────────── */

interface UserSearchSelectProps {
  /** Selected user id as a string ('' = none) — RHF form value compatible */
  value: string;
  /** Called when a user is selected (id string) or cleared ('') */
  onChange: (value: string) => void;
  /** Called with the full selected user so the parent can cache its name */
  onSelectOption?: (user: UserListItem) => void;
  /** Display label when a value is set but no option was selected here */
  selectedLabel?: string | null;
  /** Field error message */
  error?: string;
  /** Helper text */
  helperText?: string;
  /** Required marker */
  required?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Search input placeholder */
  placeholder?: string;
  /** Additional wrapper classes */
  wrapperClassName?: string;
}

/**
 * UserSearchSelect — shared, backend-driven async user picker.
 *
 * Data foundation: `useUsersSearch` (GET /users, debounced, 60s stale).
 * Reusable by any module that needs to select an existing user
 * (Doctor Management, future User Management, Appointments, etc.) —
 * deliberately NOT doctor-specific (Sprint 11A blueprint §6.4).
 *
 * Keyboard accessible: combobox semantics with ArrowUp/Down, Enter to
 * select, Escape to close; loading, empty and error states included.
 */
export const UserSearchSelect: FC<UserSearchSelectProps> = ({
  value,
  onChange,
  onSelectOption,
  selectedLabel,
  error,
  helperText,
  required = false,
  disabled = false,
  placeholder = 'Search user by name or email…',
  wrapperClassName = '',
}) => {
  const inputId = useId();
  const listboxId = `${inputId}-listbox`;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState<UserListItem | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Fetch the default page on open, then re-search as the user types
  // (the hook debounces internally).
  const search = useUsersSearch(query, !disabled && open);

  const results = search.data?.items ?? [];
  const showDropdown = open && !disabled;
  const selectedName = selectedOption?.full_name ?? selectedLabel ?? query;
  const hasValue = value.length > 0;

  const selectUser = (user: UserListItem) => {
    onChange(String(user.id));
    onSelectOption?.(user);
    setSelectedOption(user);
    setQuery('');
    setOpen(false);
    setActiveIndex(0);
  };

  const clear = () => {
    onChange('');
    setSelectedOption(null);
    setQuery('');
    setOpen(false);
    setActiveIndex(0);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!showDropdown) {
        e.preventDefault();
        setOpen(true);
        return;
      }
      if (results.length === 0) return;
      e.preventDefault();
      setActiveIndex((i) =>
        e.key === 'ArrowDown'
          ? Math.min(i + 1, results.length - 1)
          : Math.max(i - 1, 0),
      );
    } else if (e.key === 'Enter' && showDropdown && results[activeIndex]) {
      e.preventDefault();
      selectUser(results[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <FormField label="User" error={error} helperText={helperText} required={required} inputId={inputId}>
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
                <Avatar initials={getInitials(selectedName)} alt={selectedName} size="sm" />
                <span className="min-w-0 flex-1 truncate font-medium text-neutral-900">
                  {selectedName}
                </span>
              </>
            ) : (
              <span className="flex-1 text-neutral-400">User #{value}</span>
            )}
            {!disabled && (
              <button
                type="button"
                onClick={clear}
                aria-label="Clear selected user"
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
              type="text"
              id={inputId}
              role="combobox"
              aria-expanded={showDropdown}
              aria-autocomplete="list"
              aria-controls={showDropdown ? listboxId : undefined}
              aria-invalid={!!error}
              aria-activedescendant={
                showDropdown && results[activeIndex]
                  ? `${inputId}-option-${results[activeIndex].id}`
                  : undefined
              }
              value={query}
              disabled={disabled}
              placeholder={hasValue && selectedName ? selectedName : placeholder}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => {
                setOpen(true);
                setActiveIndex(0);
              }}
              onKeyDown={handleKeyDown}
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
            id={listboxId}
            role="listbox"
            aria-label="User search results"
            className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-lg"
          >
            {search.isError ? (
              <li className="flex items-center justify-between gap-2 px-3 py-2.5">
                <span className="text-body-sm text-danger">
                  Unable to load users. You may not have permission.
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void search.refetch()}
                  leftIcon={<Icon icon={RotateCw} size="sm" />}
                >
                  Retry
                </Button>
              </li>
            ) : search.isFetching ? (
              <li className="flex items-center gap-2 px-3 py-2.5 text-body-sm text-neutral-500">
                <Spinner size="sm" variant="primary" />
                Searching…
              </li>
            ) : results.length === 0 ? (
              <li className="px-3 py-2.5 text-body-sm text-neutral-500">
                {query.trim() ? 'No users found.' : 'Type to search users.'}
              </li>
            ) : (
              results.map((user, index) => (
                <li key={user.id}>
                  <button
                    type="button"
                    role="option"
                    id={`${inputId}-option-${user.id}`}
                    aria-selected={user.id === Number(value)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectUser(user)}
                    className={`
                      flex w-full items-center gap-3 px-3 py-2 text-left transition-colors duration-100
                      focus-visible:outline-none focus-visible:bg-neutral-100
                      ${
                        index === activeIndex
                          ? 'bg-neutral-100'
                          : user.id === Number(value)
                            ? 'bg-primary-50'
                            : 'hover:bg-neutral-100'
                      }
                    `}
                  >
                    <Avatar initials={getInitials(user.full_name)} alt={user.full_name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body-sm font-medium text-neutral-900">
                        {user.full_name}
                      </span>
                      <span className="block truncate text-caption text-neutral-400">
                        {user.email}
                      </span>
                    </span>
                    {user.role_name && (
                      <span className="shrink-0 text-caption text-neutral-400">{user.role_name}</span>
                    )}
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
