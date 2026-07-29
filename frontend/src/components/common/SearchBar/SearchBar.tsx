import { forwardRef, useId, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { Search, X } from 'lucide-react';
import { Icon } from '../Icon/Icon';
import { Spinner } from '../Spinner/Spinner';

interface SearchBarProps {
  /** Controlled value */
  value?: string;
  /** Default value */
  defaultValue?: string;
  /** Called when value changes (debounce-ready but does NOT debounce) */
  onChange?: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Loading state */
  loading?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Keyboard shortcut label (e.g. 'Ctrl+K') */
  shortcut?: string;
  /** Additional classes */
  className?: string;
}

/**
 * SearchBar — search input with icon, clear button, loading state,
 * and keyboard shortcut display. Does NOT debounce — use a wrapper.
 *
 * @example
 * ```tsx
 * <SearchBar
 *   onChange={(value) => handleSearch(value)}
 *   loading={isSearching}
 *   shortcut="Ctrl+K"
 * />
 * ```
 */
export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(
  (
    {
      value: controlledValue,
      defaultValue = '',
      onChange,
      placeholder = 'Search...',
      loading = false,
      disabled = false,
      shortcut,
      className = '',
    },
    ref,
  ) => {
    const generatedId = useId();
    const [internalValue, setInternalValue] = useState(defaultValue);
    const isControlled = controlledValue !== undefined;
    const currentValue = isControlled ? controlledValue : internalValue;

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (!isControlled) setInternalValue(val);
      onChange?.(val);
    };

    const handleClear = () => {
      if (!isControlled) setInternalValue('');
      onChange?.('');
      // Focus input after clearing
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape' && currentValue) {
        handleClear();
      }
    };

    return (
      <div className={`relative ${className}`}>
        {/* Search icon */}
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
          <Icon icon={Search} size="sm" />
        </div>

        {/* Input */}
        <input
          ref={ref}
          id={generatedId}
          type="search"
          value={currentValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          aria-label={placeholder}
          className={`
            w-full rounded-lg border border-neutral-300 bg-white py-2 pl-10 pr-10 text-body text-neutral-800
            placeholder:text-neutral-400
            transition-colors duration-150
            focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20
            disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400
            hover:border-neutral-400
          `}
        />

        {/* Right side: loading / clear / shortcut */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {loading ? (
            <Spinner size="sm" variant="neutral" />
          ) : currentValue ? (
            <button
              type="button"
              onClick={handleClear}
              className="rounded p-0.5 text-neutral-400 hover:text-neutral-600 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              aria-label="Clear search"
            >
              <Icon icon={X} size="sm" />
            </button>
          ) : shortcut && !disabled ? (
            <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-caption text-neutral-400 font-mono">
              {shortcut}
            </kbd>
          ) : null}
        </div>
      </div>
    );
  },
);

SearchBar.displayName = 'SearchBar';
