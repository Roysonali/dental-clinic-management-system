import { forwardRef, useId } from 'react';
import type { InputProps } from './input.types';
import { FormField } from '../Form/FormField';

/* ── Helpers ────────────────────────────────────────────────────────── */

function getInputStyles(error?: string, success?: boolean, readOnly?: boolean): string {
  if (error) return 'border-danger focus:ring-danger/20 focus:border-danger';
  if (success) return 'border-success focus:ring-success/20 focus:border-success';
  if (readOnly) return 'border-neutral-200';
  return 'border-neutral-300 hover:border-neutral-400';
}

function getInputColors(disabled?: boolean, readOnly?: boolean): string {
  if (disabled) return 'cursor-not-allowed bg-neutral-50 text-neutral-400 placeholder:text-neutral-300';
  if (readOnly) return 'cursor-default bg-neutral-50 text-neutral-700';
  return 'bg-white text-neutral-800 placeholder:text-neutral-400';
}

/* ── Component ──────────────────────────────────────────────────────── */

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      required = false,
      success = false,
      disabled = false,
      readOnly = false,
      leadingIcon: LeadingIconComponent,
      trailingIcon: TrailingIconComponent,
      trailingAction = false,
      prefix,
      suffix,
      className = '',
      wrapperClassName = '',
      id: externalId,
      ...rest
    },
    ref,
  ) => {
    const generatedId = useId();
    const inputId = externalId ?? generatedId;

    const hasLeadingContent = !!LeadingIconComponent || !!prefix;
    const hasTrailingContent = !!TrailingIconComponent || !!suffix;

    return (
      <FormField
        label={label}
        error={error}
        helperText={helperText}
        required={required}
        disabled={disabled}
        inputId={inputId}
        className={wrapperClassName}
      >
        <div className="relative">
          {/* Leading Icon */}
          {LeadingIconComponent && (
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
              {LeadingIconComponent}
            </div>
          )}

          {/* Prefix */}
          {prefix && (
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-body text-neutral-500">
              {prefix}
            </div>
          )}

          {/* Input Element */}
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            readOnly={readOnly}
            aria-invalid={!!error}
            aria-required={required}
            aria-describedby={
              [error ? `${inputId}-error` : null, helperText ? `${inputId}-helper` : null]
                .filter(Boolean)
                .join(' ') || undefined
            }
            className={`
              w-full rounded-lg border px-3 py-2.5 text-body
              transition-colors duration-150
              focus:outline-none focus:ring-2
              ${getInputColors(disabled, readOnly)}
              ${getInputStyles(error, success, readOnly)}
              ${hasLeadingContent ? 'pl-10' : ''}
              ${hasTrailingContent ? 'pr-10' : ''}
              ${className}
            `}
            {...rest}
          />

          {/* Suffix */}
          {suffix && (
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-body text-neutral-500">
              {suffix}
            </div>
          )}

          {/* Trailing Icon — decorative by default (pointer-events-none);
              interactive controls (e.g. a password visibility toggle) opt
              in via `trailingAction` so their clicks are never swallowed
              by the input beneath. */}
          {TrailingIconComponent && (
            <div
              className={`absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 ${
                trailingAction ? 'pointer-events-auto' : 'pointer-events-none'
              }`}
            >
              {TrailingIconComponent}
            </div>
          )}
        </div>
      </FormField>
    );
  },
);

Input.displayName = 'Input';
