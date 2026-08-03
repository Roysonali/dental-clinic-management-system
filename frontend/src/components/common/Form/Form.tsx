import { forwardRef, type FormEvent, type FormHTMLAttributes } from 'react';

/* ── Props ─────────────────────────────────────────────────────────── */

export interface FormProps extends Omit<FormHTMLAttributes<HTMLFormElement>, 'onSubmit'> {
  /** Submit handler (default form submission is prevented) */
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  /** Render children in a responsive two-column grid */
  grid?: boolean;
  /** Column layout override (1 or 2) when grid is enabled */
  columns?: 1 | 2;
  /** Gap between form fields */
  spacing?: 'sm' | 'md' | 'lg';
}

const spacingMap = {
  sm: 'gap-3',
  md: 'gap-4',
  lg: 'gap-6',
} as const;

/**
 * Form — semantic form wrapper with `noValidate` and prevented default
 * submission. Use with react-hook-form:
 *
 * ```tsx
 * <Form onSubmit={handleSubmit(onSave)}>
 *   <Input label="Email" {...register('email')} />
 * </Form>
 * ```
 *
 * Set `grid` to lay fields out in a responsive grid (1 col mobile,
 * 2 cols desktop).
 */
export const Form = forwardRef<HTMLFormElement, FormProps>(
  (
    {
      onSubmit,
      grid = false,
      columns = 2,
      spacing = 'md',
      children,
      className = '',
      ...rest
    },
    ref,
  ) => {
    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      onSubmit?.(event);
    };

    return (
      <form
        ref={ref}
        noValidate
        onSubmit={handleSubmit}
        className={`
          ${grid ? `grid ${columns === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'} ${spacingMap[spacing]}` : ''}
          ${className}
        `}
        {...rest}
      >
        {children}
      </form>
    );
  },
);

Form.displayName = 'Form';
