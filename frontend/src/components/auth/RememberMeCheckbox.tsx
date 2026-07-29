import { forwardRef, type InputHTMLAttributes } from 'react';
import { Checkbox } from '../common/Checkbox';

interface RememberMeCheckboxProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'type' | 'label'
  > {
  /** Whether the field has an error */
  error?: boolean;
}

/**
 * "Keep me signed in" checkbox with descriptive label.
 * Uses the `remember_me` field name matching backend conventions.
 */
export const RememberMeCheckbox = forwardRef<
  HTMLInputElement,
  RememberMeCheckboxProps
>(({ error, disabled, ...rest }, ref) => {
  return (
    <Checkbox
      ref={ref}
      label={
        <span>
          Keep me signed in{' '}
          <span className="text-neutral-400">on this workstation</span>
        </span>
      }
      error={error}
      disabled={disabled}
      {...rest}
    />
  );
});

RememberMeCheckbox.displayName = 'RememberMeCheckbox';
