import type { FC, ReactNode } from 'react';
import { useId } from 'react';
import { Label } from './Label';
import { HelperText } from './HelperText';
import { ErrorMessage } from './ErrorMessage';

interface FormFieldProps {
  /** Label text */
  label?: string;
  /** Error message */
  error?: string;
  /** Helper/description text (hidden when error is shown) */
  helperText?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** The input element (children) */
  children: ReactNode;
  /** ID of the input element (for aria-describedby) */
  inputId?: string;
  /** Extra element rendered at the right of the label */
  extra?: ReactNode;
  /** Wrapper className */
  className?: string;
}

/**
 * FormField — wrapper that composes Label, input children, ErrorMessage,
 * and HelperText into a consistent form field layout.
 *
 * Every form control (Input, Textarea, Select) should use FormField internally.
 *
 * @example
 * ```tsx
 * <FormField label="Email" error={error} helperText="Enter your email" required>
 *   <input id="email" ... />
 * </FormField>
 * ```
 */
export const FormField: FC<FormFieldProps> = ({
  label,
  error,
  helperText,
  required = false,
  disabled = false,
  children,
  inputId,
  extra,
  className = '',
}) => {
  const generatedId = useId();
  const fieldId = inputId ?? generatedId;
  const errorId = `${fieldId}-error`;
  const helperId = `${fieldId}-helper`;

  return (
    <div className={`flex flex-col gap-1.5 ${disabled ? 'opacity-60' : ''} ${className}`}>
      {/* Label */}
      {label && (
        <Label htmlFor={fieldId} required={required} extra={extra}>
          {label}
        </Label>
      )}

      {/* Input Children */}
      {children}

      {/* Error Message */}
      {error && (
        <ErrorMessage id={errorId}>{error}</ErrorMessage>
      )}

      {/* Helper Text (hidden when error exists) */}
      {helperText && !error && (
        <HelperText id={helperId}>{helperText}</HelperText>
      )}
    </div>
  );
};
