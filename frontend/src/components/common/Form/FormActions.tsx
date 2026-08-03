import type { FC, ReactNode } from 'react';
import { Button } from '../Button/Button';

/* ── Props ─────────────────────────────────────────────────────────── */

interface FormActionsProps {
  /** Submit button label */
  submitText?: string;
  /** Cancel button label (hidden when onCancel is not provided) */
  cancelText?: string;
  /** Called when the cancel button is clicked */
  onCancel?: () => void;
  /** Show loading state on the submit button */
  submitting?: boolean;
  /** Disable the submit button */
  submitDisabled?: boolean;
  /** Disable the cancel button */
  cancelDisabled?: boolean;
  /** Horizontal alignment of the action row */
  align?: 'left' | 'right' | 'between' | 'end';
  /** Stretch submit button to full width (mobile-friendly) */
  fullWidth?: boolean;
  /** Extra actions rendered before the buttons */
  children?: ReactNode;
  /** Additional classes */
  className?: string;
}

const alignMap = {
  left: 'justify-start',
  right: 'justify-end',
  between: 'justify-between',
  end: 'justify-end',
} as const;

/**
 * FormActions — standardised submit/cancel action row for forms.
 *
 * @example
 * ```tsx
 * <FormActions
 *   onCancel={() => navigate(-1)}
 *   submitting={isSubmitting}
 *   submitText="Save Patient"
 * />
 * ```
 */
export const FormActions: FC<FormActionsProps> = ({
  submitText = 'Save',
  cancelText = 'Cancel',
  onCancel,
  submitting = false,
  submitDisabled = false,
  cancelDisabled = false,
  align = 'right',
  fullWidth = false,
  children,
  className = '',
}) => {
  return (
    <div
      className={`
        flex flex-col gap-3 sm:flex-row sm:items-center
        ${alignMap[align]}
        ${fullWidth ? 'sm:[&>*]:flex-1' : ''}
        ${className}
      `}
    >
      {children}
      {onCancel && (
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={cancelDisabled}
          className={fullWidth ? 'w-full sm:w-auto' : ''}
        >
          {cancelText}
        </Button>
      )}
      <Button
        type="submit"
        variant="primary"
        loading={submitting}
        disabled={submitDisabled}
        className={fullWidth ? 'w-full sm:w-auto' : ''}
      >
        {submitText}
      </Button>
    </div>
  );
};
