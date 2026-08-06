import type { FC, RefObject } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormActions, ValidationSummary } from '../common/Form';
import { Input, PasswordInput, Select } from '../common/Input';
import { USER_ROLE_OPTIONS } from '../../constants/user';
import { userCreateSchema } from '../../utils/userCreateSchema';
import type { UserCreateFormValues } from '../../types/user';

const PASSWORD_HELPER =
  '8–128 characters with at least one uppercase letter, one lowercase letter, one digit and one special character.';

interface UserCreateFormProps {
  /** Called with validated form values (already normalized by the schema) */
  onSubmit: (values: UserCreateFormValues) => void;
  /** Show loading state on the submit button */
  submitting?: boolean;
  /** Called when cancel / close is clicked */
  onCancel?: () => void;
  /** Server-level error banner message (e.g. 409 duplicate email) */
  serverMessage?: string | null;
  /** Server-side field errors (snake_case keys) injected into the form */
  serverErrors?: Record<string, string>;
  /**
   * Optional ref for the first field (Full Name) — the drawer focuses it
   * on open via the shared Drawer `initialFocusRef` mechanism.
   */
  firstFieldRef?: RefObject<HTMLInputElement | null>;
}

/**
 * UserCreateForm — presentational Add-User form (Sprint 11B Phase 1D).
 *
 * Pure: no API calls, no business logic, no navigation. The container owns
 * the register → approve workflow and server errors.
 *
 * Exactly four fields, mirroring the backend contract:
 *   full_name + email + password  → POST /auth/register
 *   role_id                       → PATCH /auth/users/{id}/approve
 * No invented fields (no username, phone, address, avatar, dob, status).
 * Validation mirrors `userCreateSchema` (backend `UserRegister` rules)
 * exactly — no frontend-only rules.
 */
export const UserCreateForm: FC<UserCreateFormProps> = ({
  onSubmit,
  submitting = false,
  onCancel,
  serverMessage = null,
  serverErrors = {},
  firstFieldRef,
}) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UserCreateFormValues>({
    resolver: zodResolver(userCreateSchema),
    mode: 'onTouched',
    defaultValues: {
      full_name: '',
      email: '',
      password: '',
      role_id: '',
    },
  });

  // Full Name is the drawer's initial-focus target: forward the RHF ref
  // (needed for defaultValue sync) AND the drawer-provided focus ref.
  const fullNameField = register('full_name');

  /** Merge client + server field errors for display. */
  const fieldError = (field: keyof UserCreateFormValues) =>
    errors[field]?.message ?? serverErrors[field];

  return (
    <div className="flex flex-col gap-4">
      {serverMessage && (
        <div role="alert" className="rounded-lg border border-danger/25 bg-danger/10 p-4">
          <p className="text-body-sm text-danger">{serverMessage}</p>
        </div>
      )}

      <ValidationSummary errors={errors} title="Please review the following fields:" />

      <Form grid columns={1} spacing="md" onSubmit={handleSubmit(onSubmit)}>
        <Input
          label="Full Name"
          placeholder="Juan Dela Cruz"
          autoComplete="name"
          required
          error={fieldError('full_name')}
          {...fullNameField}
          ref={(element) => {
            fullNameField.ref(element);
            if (firstFieldRef) firstFieldRef.current = element;
          }}
        />
        <Input
          label="Email Address"
          type="email"
          placeholder="name@clinic.com"
          autoComplete="email"
          inputMode="email"
          required
          error={fieldError('email')}
          {...register('email')}
        />
        <PasswordInput
          label="Password"
          placeholder="Create a strong password"
          autoComplete="new-password"
          helperText={PASSWORD_HELPER}
          error={fieldError('password')}
          {...register('password')}
        />
        <Select
          label="Role"
          placeholder="Select a role"
          required
          options={USER_ROLE_OPTIONS}
          error={fieldError('role_id')}
          {...register('role_id')}
        />

        <div className="flex flex-col gap-3 pt-1">
          <p className="text-caption text-neutral-500">
            The account is created via the public registration endpoint and approved
            immediately with the selected role. This action is recorded with your
            admin id.
          </p>
          <FormActions
            onCancel={onCancel}
            submitting={submitting}
            cancelDisabled={submitting}
            submitText="Add User"
            size="lg"
            fullWidth
            className="w-full"
          />
        </div>
      </Form>
    </div>
  );
};
