import type { FC, ReactNode } from 'react';

interface RadioGroupProps {
  /** Group label (rendered as legend) */
  label?: string;
  /** Whether the group is required */
  required?: boolean;
  /** Error message for the group */
  error?: string;
  /** Radio items */
  children: ReactNode;
  /** Horizontal layout */
  inline?: boolean;
  /** Additional className */
  className?: string;
}

/**
 * Radio group — wraps Radio items in a fieldset with legend.
 *
 * @example
 * ```tsx
 * <RadioGroup label="Gender" required>
 *   <Radio value="male" label="Male" {...register('gender')} />
 *   <Radio value="female" label="Female" {...register('gender')} />
 * </RadioGroup>
 * ```
 */
export const RadioGroup: FC<RadioGroupProps> = ({
  label,
  required,
  error,
  children,
  inline = false,
  className = '',
}) => {
  return (
    <fieldset className={`flex flex-col gap-2 ${className}`}>
      {label && (
        <legend className="text-label font-medium text-neutral-700">
          {label}
          {required && (
            <span className="ml-0.5 text-danger" aria-hidden="true">*</span>
          )}
        </legend>
      )}

      <div className={inline ? 'flex flex-wrap gap-4' : 'flex flex-col gap-2'}>
        {children}
      </div>

      {error && (
        <p className="text-caption text-danger" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
};
