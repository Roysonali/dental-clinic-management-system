import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { Input } from './Input';
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
        trailingIcon={
          <button
            type="button"
            onClick={() => setVisible((prev) => !prev)}
            className="flex items-center justify-center text-neutral-400 hover:text-neutral-600 transition-colors duration-150 focus:outline-none"
            aria-label={toggleLabel}
            tabIndex={-1}
          >
            <Icon
              icon={visible ? EyeOff : Eye}
              size="sm"
              className="text-neutral-400"
            />
          </button>
        }
        {...rest}
      />
    );
  },
);

PasswordInput.displayName = 'PasswordInput';
