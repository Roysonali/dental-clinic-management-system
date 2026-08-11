import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { Input } from './Input';
import { IconButton } from '../Button/IconButton';
import { Icon } from '../Icon/Icon';

interface PasswordInputProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'type' | 'label' | 'leadingIcon' | 'trailingIcon'
  > {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  success?: boolean;
}

/**
 * Password input with lock icon (leading) and visibility toggle (trailing).
 * Extends the base Input component — no duplicated Input logic.
 *
 * The toggle is a shared design-system IconButton rendered in Input's
 * `trailingAction` slot: `trailingAction` lifts `pointer-events-none` off the
 * trailing wrapper (the eye must be clickable in a real browser), keeps it in
 * the tab order (keyboard accessible), and shows a visible focus ring.
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  (
    {
      label = 'Password',
      error,
      helperText,
      required = true,
      success,
      disabled,
      ...rest
    },
    ref,
  ) => {
    const [visible, setVisible] = useState(false);
    const toggleLabel = visible ? 'Hide password' : 'Show password';

    return (
      <Input
        ref={ref}
        type={visible ? 'text' : 'password'}
        label={label}
        error={error}
        helperText={helperText}
        required={required}
        success={success}
        disabled={disabled}
        autoComplete="current-password"
        leadingIcon={<Icon icon={Lock} size="sm" className="text-neutral-400" />}
        trailingAction
        trailingIcon={
          <IconButton
            type="button"
            variant="ghost"
            size="sm"
            icon={<Icon icon={visible ? EyeOff : Eye} size="sm" />}
            aria-label={toggleLabel}
            title={toggleLabel}
            disabled={disabled}
            onClick={() => setVisible((prev) => !prev)}
          />
        }
        {...rest}
      />
    );
  },
);

PasswordInput.displayName = 'PasswordInput';
