import { forwardRef, useId, useRef, useEffect, useCallback } from 'react';
import type { TextareaProps } from './input.types';
import { FormField } from '../Form/FormField';

/* ── Component ──────────────────────────────────────────────────────── */

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      helperText,
      required = false,
      disabled = false,
      readOnly = false,
      autoResize = false,
      showCharCount = false,
      maxLength,
      className = '',
      wrapperClassName = '',
      id: externalId,
      value,
      ...rest
    },
    ref,
  ) => {
    const generatedId = useId();
    const textareaId = externalId ?? generatedId;
    const innerRef = useRef<HTMLTextAreaElement | null>(null);

    // Merge forwarded ref with local ref for auto-resize
    const setRef = useCallback(
      (element: HTMLTextAreaElement | null) => {
        innerRef.current = element;
        if (typeof ref === 'function') ref(element);
        else if (ref) ref.current = element;
      },
      [ref],
    );

    // Auto-resize logic
    useEffect(() => {
      if (!autoResize || !innerRef.current) return;
      const textarea = innerRef.current;
      const resize = () => {
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
      };
      resize();
    }, [autoResize, value]);

    const charCount =
      showCharCount && maxLength != null
        ? `${String(value ?? '').length}/${maxLength}`
        : null;

    return (
      <FormField
        label={label}
        error={error}
        helperText={helperText}
        required={required}
        disabled={disabled}
        inputId={textareaId}
        className={wrapperClassName}
        extra={charCount ? <span className="text-caption text-neutral-400">{charCount}</span> : undefined}
      >
        <textarea
          ref={setRef}
          id={textareaId}
          disabled={disabled}
          readOnly={readOnly}
          maxLength={maxLength}
          aria-invalid={!!error}
          aria-required={required}
          aria-describedby={
            [error ? `${textareaId}-error` : null, helperText ? `${textareaId}-helper` : null]
              .filter(Boolean)
              .join(' ') || undefined
          }
          className={`
            w-full rounded-lg border bg-white px-3 py-2.5 text-body text-neutral-800
            placeholder:text-neutral-400
            transition-colors duration-150
            focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500
            disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400
            readOnly:cursor-default readOnly:bg-neutral-50
            resize-y min-h-[80px]
            ${error ? 'border-danger focus:ring-danger/20 focus:border-danger' : 'border-neutral-300 hover:border-neutral-400'}
            ${className}
          `}
          value={value}
          {...rest}
        />
      </FormField>
    );
  },
);

Textarea.displayName = 'Textarea';
