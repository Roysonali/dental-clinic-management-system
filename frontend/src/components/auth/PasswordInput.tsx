import {
  forwardRef,
  useState,
  type InputHTMLAttributes,
} from 'react';
import { Input } from '../common/Input';

interface PasswordInputProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'type' | 'label' | 'leadingIcon' | 'trailingIcon'
  > {
  label?: string;
  error?: string;
  required?: boolean;
}

/**
 * Password input field with lock icon (leading) and visibility toggle (trailing).
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  (
    {
      label = 'Password',
      error,
      required = true,
      disabled,
      className,
      ...rest
    },
    ref,
  ) => {
    const [visible, setVisible] = useState(false);

    return (
      <Input
        ref={ref}
        type={visible ? 'text' : 'password'}
        label={label}
        error={error}
        required={required}
        disabled={disabled}
        autoComplete="current-password"
        leadingIcon={
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M13 5.5H12.5V4C12.5 2.07 10.93 0.5 9 0.5C7.07 0.5 5.5 2.07 5.5 4V5.5H5C4.17 5.5 3.5 6.17 3.5 7V12C3.5 12.83 4.17 13.5 5 13.5H13C13.83 13.5 14.5 12.83 14.5 12V7C14.5 6.17 13.83 5.5 13 5.5ZM9 10.5C8.17 10.5 7.5 9.83 7.5 9C7.5 8.17 8.17 7.5 9 7.5C9.83 7.5 10.5 8.17 10.5 9C10.5 9.83 9.83 10.5 9 10.5ZM10.83 5.5H7.17V4C7.17 2.99 7.99 2.17 9 2.17C10.01 2.17 10.83 2.99 10.83 4V5.5Z"
              fill="currentColor"
            />
          </svg>
        }
        trailingIcon={
          <button
            type="button"
            onClick={() => setVisible((prev) => !prev)}
            className="flex items-center justify-center text-neutral-400 hover:text-neutral-600 transition-colors duration-150 focus:outline-none"
            aria-label={visible ? 'Hide password' : 'Show password'}
            tabIndex={-1}
          >
            {visible ? (
              /* Eye off (hidden) */
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M8 3C4.67 3 1.83 5.07 0.67 8C1.83 10.93 4.67 13 8 13C11.33 13 14.17 10.93 15.33 8C14.17 5.07 11.33 3 8 3ZM8 11C6.34 11 5 9.66 5 8C5 6.34 6.34 5 8 5C9.66 5 11 6.34 11 8C11 9.66 9.66 11 8 11Z"
                  fill="currentColor"
                />
                <path
                  d="M2 2L14 14"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              /* Eye on (visible) */
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M8 3C4.67 3 1.83 5.07 0.67 8C1.83 10.93 4.67 13 8 13C11.33 13 14.17 10.93 15.33 8C14.17 5.07 11.33 3 8 3ZM8 11C6.34 11 5 9.66 5 8C5 6.34 6.34 5 8 5C9.66 5 11 6.34 11 8C11 9.66 9.66 11 8 11Z"
                  fill="currentColor"
                />
              </svg>
            )}
          </button>
        }
        {...rest}
      />
    );
  },
);

PasswordInput.displayName = 'PasswordInput';
