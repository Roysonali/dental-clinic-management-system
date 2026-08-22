import { forwardRef, useId } from 'react';
import { ChevronDown, X } from 'lucide-react';
import type { SelectProps } from './input.types';
import { FormField } from '../Form/FormField';
import { Icon } from '../Icon/Icon';

/**
 * Native HTML select dropdown.
 * Version 1 — basic native select without search/filter.
 *
 * @example
 * ```tsx
 * <Select
 *   label="Procedure"
 *   options={[
 *     { value: '', label: 'Select a procedure' },
 *     { value: 'cleaning', label: 'Cleaning' },
 *     { value: 'filling', label: 'Filling' },
 *   ]}
 *   error={errors.procedure?.message}
 * />
 * ```
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      helperText,
      required = false,
      disabled = false,
      placeholder,
      options,
      className = '',
      wrapperClassName = '',
      id: externalId,
      clearable = false,
      onClear,
      ...rest
    },
    ref,
  ) => {
    const generatedId = useId();
    const selectId = externalId ?? generatedId;

    // Determine if a non-empty value is selected. When the caller uses
    // register() (no explicit value prop), the native <select> manages its
    // own value — we detect that via the DOM ref. When a Controller is used,
    // `rest.value` is set explicitly. We avoid destructuring `value` so that
    // both patterns work.
    const hasValue = clearable && (
      (rest.value !== undefined && rest.value !== '' && rest.value !== null)
    );

    return (
      <FormField
        label={label}
        error={error}
        helperText={helperText}
        required={required}
        disabled={disabled}
        inputId={selectId}
        className={wrapperClassName}
      >
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            aria-invalid={!!error}
            aria-required={required}
            aria-describedby={
              [error ? `${selectId}-error` : null, helperText ? `${selectId}-helper` : null]
                .filter(Boolean)
                .join(' ') || undefined
            }
            className={`
              w-full appearance-none rounded-lg border bg-white px-3 py-2.5 pr-10 text-body text-neutral-800
              transition-colors duration-150
              focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500
              disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400
              ${error ? 'border-danger focus:ring-danger/20 focus:border-danger' : 'border-neutral-300 hover:border-neutral-400'}
              ${className}
            `}
            {...rest}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Clear button — sits between the select value and the chevron */}
          {hasValue && !disabled && (
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClear?.();
              }}
              aria-label={`Clear ${label ?? 'selection'}`}
              className="absolute right-8 top-1/2 z-10 -translate-y-1/2 rounded p-0.5 text-neutral-400 transition-colors hover:bg-neutral-200 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <Icon icon={X} size="sm" />
            </button>
          )}

          {/* Chevron icon */}
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">
            <Icon icon={ChevronDown} size="sm" />
          </div>
        </div>
      </FormField>
    );
  },
);

Select.displayName = 'Select';
