import { useState, type FC } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { PasswordInput } from '../../common/Input';
import { Button } from '../../common/Button';
import { parseApiError } from '../../../services/apiError';
import { passwordSchema } from '../../../utils/passwordSchema';
import type { ResetPasswordFormValues } from '../../../types/auth';

/* ── Zod Validation Schema ─────────────────────────────────────────── */
// Reuses the shared `passwordSchema` — the same policy as registration —
// so frontend and backend password rules stay identical (backend remains
// authoritative).

const resetPasswordSchema = z
  .object({
    new_password: passwordSchema,
    confirm_password: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });

/* ── Props ──────────────────────────────────────────────────────────── */

interface ResetPasswordFormProps {
  /** Called with validated values; the page owns the API call. */
  onSubmit?: (values: ResetPasswordFormValues) => void | Promise<void>;
}

/* ── Component ──────────────────────────────────────────────────────── */

export const ResetPasswordForm: FC<ResetPasswordFormProps> = ({ onSubmit }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    mode: 'onTouched',
    defaultValues: {
      new_password: '',
      confirm_password: '',
    },
  });

  const handleFormSubmit = async (values: ResetPasswordFormValues) => {
    setSubmitError(null);
    setIsLoading(true);

    try {
      if (onSubmit) {
        await onSubmit(values);
      }
    } catch (error) {
      // The page rethrows non-token errors (network / 5xx) so they land
      // here; token errors (400) are intercepted by the page and switch it
      // to the invalid-link state instead.
      setSubmitError(parseApiError(error).message);
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

      {/* ── New Password Field ──────────────────────────── */}
      <PasswordInput
        label="New password"
        placeholder="Create a strong password"
        autoComplete="new-password"
        error={errors.new_password?.message}
        {...register('new_password')}
      />

      {/* ── Confirm Password Field ──────────────────────── */}
      <PasswordInput
        label="Confirm new password"
        placeholder="Re-enter your new password"
        autoComplete="new-password"
        error={errors.confirm_password?.message}
        {...register('confirm_password')}
      />

      {/* ── Submit Button ───────────────────────────────── */}
      <Button
        type="submit"
        size="lg"
        fullWidth
        loading={isLoading}
        disabled={!isValid || isLoading}
      >
        {isLoading ? 'Resetting...' : 'Reset Password'}
      </Button>
    </form>
  );
};
