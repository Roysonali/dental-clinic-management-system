import { useState, type FC } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { PasswordInput } from './PasswordInput';
import { RememberMeCheckbox } from './RememberMeCheckbox';
import type { LoginFormValues } from '../../types/auth';

/* ── Zod Validation Schema ─────────────────────────────────────────── */

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email address is required')
    .email('Please enter a valid email address')
    .transform((val) => val.trim().toLowerCase()),
  password: z
    .string()
    .min(1, 'Password is required'),
  remember_me: z.boolean().optional(),
});

/* ── Props ──────────────────────────────────────────────────────────── */

interface LoginFormProps {
  /** Called with validated form values (for future API integration) */
  onSubmit?: (values: LoginFormValues) => void | Promise<void>;
}

/* ── Component ──────────────────────────────────────────────────────── */

export const LoginForm: FC<LoginFormProps> = ({ onSubmit }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onTouched',
    defaultValues: {
      email: '',
      password: '',
      remember_me: false,
    },
  });

  const handleFormSubmit = async (values: LoginFormValues) => {
    setSubmitError(null);
    setIsLoading(true);

    try {
      if (onSubmit) {
        await onSubmit(values);
      }
    } catch {
      setSubmitError(
        'Unable to sign in. Please check your credentials and try again.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const canSubmit = isValid;

  return (
    <form
      onSubmit={handleSubmit(handleFormSubmit)}
      noValidate
      className="flex flex-col gap-5"
    >
      {/* ── Submit Error Banner ─────────────────────────── */}
      {submitError && (
        <div
          className="flex items-start gap-2 rounded-lg bg-danger/10 px-4 py-3"
          role="alert"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="mt-0.5 shrink-0 text-danger"
            aria-hidden="true"
          >
            <path
              d="M8 1C4.13 1 1 4.13 1 8C1 11.87 4.13 15 8 15C11.87 15 15 11.87 15 8C15 4.13 11.87 1 8 1ZM8 11.5C7.59 11.5 7.25 11.16 7.25 10.75V7.25C7.25 6.84 7.59 6.5 8 6.5C8.41 6.5 8.75 6.84 8.75 7.25V10.75C8.75 11.16 8.41 11.5 8 11.5ZM8.75 5.25H7.25V3.75H8.75V5.25Z"
              fill="currentColor"
            />
          </svg>
          <p className="text-body-sm text-danger">{submitError}</p>
        </div>
      )}

      {/* ── Email Field ──────────────────────────────────── */}
      <Input
        label="Email address"
        type="email"
        placeholder="name@denscare.clinic"
        autoComplete="email"
        inputMode="email"
        required
        error={errors.email?.message}
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
              d="M14 3H2C1.45 3 1 3.45 1 4V12C1 12.55 1.45 13 2 13H14C14.55 13 15 12.55 15 12V4C15 3.45 14.55 3 14 3ZM13.17 4L8 7.75L2.83 4H13.17ZM2 11.5V5.17L7.66 9.41C7.87 9.56 8.13 9.56 8.34 9.41L14 5.17V11.5H2Z"
              fill="currentColor"
            />
          </svg>
        }
        {...register('email')}
      />

      {/* ── Password Field ───────────────────────────────── */}
      <div className="relative">
        <PasswordInput
          error={errors.password?.message}
          placeholder="Enter your password"
          {...register('password')}
        />

        {/* Forgot Password Link */}
        <a
          href="/auth/forgot-password"
          className="absolute right-0 top-0 text-label font-medium text-primary-600 hover:text-primary-700 transition-colors duration-150"
          tabIndex={-1}
        >
          Forgot password?
        </a>
      </div>

      {/* ── Remember Me Checkbox ─────────────────────────── */}
      <RememberMeCheckbox {...register('remember_me')} />

      {/* ── Submit Button ─────────────────────────────────── */}
      <Button
        type="submit"
        size="lg"
        fullWidth
        loading={isLoading}
        disabled={!canSubmit || isLoading}
        trailingIcon={
          !isLoading && (
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M3 8H13M13 8L9 4M13 8L9 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )
        }
      >
        {isLoading ? 'Signing in...' : 'Sign in'}
      </Button>
    </form>
  );
};
