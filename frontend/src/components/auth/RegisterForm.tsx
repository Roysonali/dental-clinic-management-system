import { useState, type FC } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { Checkbox } from '../common/Checkbox';
import { PasswordInput } from './PasswordInput';
import type { RegisterFormValues } from '../../types/auth';

/* ── Password Strength Calculation ─────────────────────────────────── */

type PasswordStrength = 'none' | 'weak' | 'fair' | 'strong';

function getPasswordStrength(password: string): {
  strength: PasswordStrength;
  score: number;
  label: string;
} {
  let score = 0;

  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;

  if (score <= 1) return { strength: 'weak', score, label: 'Weak' };
  if (score <= 3) return { strength: 'fair', score, label: 'Fair' };
  return { strength: 'strong', score, label: 'Strong' };
}

const strengthColors: Record<PasswordStrength, string> = {
  none: 'bg-neutral-200',
  weak: 'bg-danger',
  fair: 'bg-warning',
  strong: 'bg-success',
};

/* ── Zod Validation Schema ─────────────────────────────────────────── */

const registerSchema = z
  .object({
    full_name: z
      .string()
      .min(2, 'Full name must be at least 2 characters')
      .max(100, 'Full name must not exceed 100 characters')
      .transform((val) => val.trim().replace(/\s+/g, ' ')),
    email: z
      .string()
      .min(1, 'Email address is required')
      .email('Please enter a valid email address')
      .transform((val) => val.trim().toLowerCase()),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password must not exceed 128 characters')
      .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Must contain at least one lowercase letter')
      .regex(/\d/, 'Must contain at least one digit')
      .regex(
        /[^a-zA-Z0-9]/,
        'Must contain at least one special character',
      ),
    confirm_password: z.string().min(1, 'Please confirm your password'),
    terms_accepted: z.literal(true, {
      errorMap: () => ({
        message: 'You must accept the terms to proceed',
      }),
    }),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });

/* ── Props ──────────────────────────────────────────────────────────── */

interface RegisterFormProps {
  /** Called with validated form values (for future API integration) */
  onSubmit?: (values: RegisterFormValues) => void | Promise<void>;
}

/* ── Component ──────────────────────────────────────────────────────── */

export const RegisterForm: FC<RegisterFormProps> = ({ onSubmit }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    mode: 'onTouched',
    defaultValues: {
      full_name: '',
      email: '',
      password: '',
      confirm_password: '',
      terms_accepted: false as unknown as true,
    },
  });

  const watchedPassword = watch('password');
  const { strength, score, label } = getPasswordStrength(
    watchedPassword || '',
  );

  const handleFormSubmit = async (values: RegisterFormValues) => {
    setSubmitError(null);
    setIsLoading(true);

    try {
      if (onSubmit) {
        await onSubmit(values);
      }
    } catch {
      setSubmitError(
        'Registration failed. Please try again later.',
      );
    } finally {
      setIsLoading(false);
    }
  };

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

      {/* ── Full Name Field ────────────────────────────────── */}
      <Input
        label="Full name"
        type="text"
        placeholder="Juan Dela Cruz"
        autoComplete="name"
        required
        error={errors.full_name?.message}
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
              d="M8 8C9.93 8 11.5 6.43 11.5 4.5C11.5 2.57 9.93 1 8 1C6.07 1 4.5 2.57 4.5 4.5C4.5 6.43 6.07 8 8 8Z"
              fill="currentColor"
            />
            <path
              d="M8 9.5C5.33 9.5 1 10.84 1 13.5V15H15V13.5C15 10.84 10.67 9.5 8 9.5Z"
              fill="currentColor"
            />
          </svg>
        }
        {...register('full_name')}
      />

      {/* ── Email Field ────────────────────────────────────── */}
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

      {/* ── Password Field ──────────────────────────────────── */}
      <div className="flex flex-col gap-1.5">
        <PasswordInput
          label="Password"
          placeholder="Create a strong password"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register('password')}
        />

        {/* Password Strength Indicator */}
        {watchedPassword && watchedPassword.length > 0 && (
          <div className="mt-1 space-y-1">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5, 6].map((bar) => (
                <div
                  key={bar}
                  className={`h-1 flex-1 rounded-full transition-colors duration-200 ${
                    bar <= score
                      ? strengthColors[strength]
                      : 'bg-neutral-200'
                  }`}
                  aria-hidden="true"
                />
              ))}
            </div>
            <p className="text-caption text-neutral-500">
              Password strength:{' '}
              <span
                className={`font-medium ${
                  strength === 'weak'
                    ? 'text-danger'
                    : strength === 'fair'
                      ? 'text-warning'
                      : 'text-success'
                }`}
              >
                {label}
              </span>
            </p>
          </div>
        )}

        {/* Password Requirements Checklist */}
        {watchedPassword && watchedPassword.length > 0 && (
          <ul className="mt-1 space-y-1" aria-label="Password requirements">
            {[
              { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
              { label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
              { label: 'One lowercase letter', test: (p: string) => /[a-z]/.test(p) },
              { label: 'One digit', test: (p: string) => /\d/.test(p) },
              { label: 'One special character', test: (p: string) => /[^a-zA-Z0-9]/.test(p) },
            ].map((req) => {
              const met = req.test(watchedPassword);
              return (
                <li
                  key={req.label}
                  className={`flex items-center gap-1.5 text-caption ${
                    met ? 'text-success' : 'text-neutral-400'
                  }`}
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    {met ? (
                      <path
                        d="M2 5L4 7L8 3"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ) : (
                      <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1" />
                    )}
                  </svg>
                  {req.label}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ── Confirm Password Field ──────────────────────────── */}
      <PasswordInput
        label="Confirm password"
        placeholder="Re-enter your password"
        autoComplete="new-password"
        error={errors.confirm_password?.message}
        {...register('confirm_password')}
      />

      {/* ── Terms Checkbox ───────────────────────────────────── */}
      <div>
        <Checkbox
          label={
            <span className="text-body text-neutral-600">
              I agree to the{' '}
              <a
                href="#"
                className="font-medium text-primary-600 hover:text-primary-700 transition-colors duration-150"
              >
                Terms of Service
              </a>{' '}
              and{' '}
              <a
                href="#"
                className="font-medium text-primary-600 hover:text-primary-700 transition-colors duration-150"
              >
                Privacy Policy
              </a>
            </span>
          }
          error={!!errors.terms_accepted}
          {...register('terms_accepted')}
        />
        {errors.terms_accepted && (
          <p className="mt-1 text-caption text-danger" role="alert">
            {errors.terms_accepted.message}
          </p>
        )}
      </div>

      {/* ── Submit Button ────────────────────────────────────── */}
      <Button
        type="submit"
        size="lg"
        fullWidth
        loading={isLoading}
        disabled={!isValid || isLoading}
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
                d="M12 3H4C2.9 3 2 3.9 2 5V13L5 10H12C13.1 10 14 9.1 14 8V5C14 3.9 13.1 3 12 3Z"
                fill="currentColor"
              />
            </svg>
          )
        }
      >
        {isLoading ? 'Submitting...' : 'Request access'}
      </Button>
    </form>
  );
};
