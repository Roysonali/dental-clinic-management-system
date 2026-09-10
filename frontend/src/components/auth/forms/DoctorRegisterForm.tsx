import { useState, useRef, type FC, type KeyboardEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Input, PasswordInput, Select } from '../../common/Input';
import { Button } from '../../common/Button';
import { Checkbox } from '../../common/Checkbox';
import { parseApiError } from '../../../services/apiError';
import { passwordSchema } from '../../../utils/passwordSchema';
import type { DoctorRegisterFormValues } from '../../../types/auth';

/* ── Zod Validation Schema ─────────────────────────────────────── */

const doctorRegisterSchema = z
  .object({
    // Step 1: Account
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
    password: passwordSchema,
    confirm_password: z.string().min(1, 'Please confirm your password'),
    terms_accepted: z
      .boolean()
      .refine((v) => v === true, {
        message: 'You must accept the terms to proceed',
      }),

    // Step 2: Professional
    qualification: z.string().optional(),
    registration_number: z.string().optional(),
    years_of_experience: z
      .number()
      .min(0, 'Must be at least 0')
      .max(50, 'Must be at most 50')
      .optional()
      .or(z.nan().transform(() => undefined)),

    // Step 3: Personal
    primary_phone: z.string().optional(),
    date_of_birth: z.string().optional(),
    gender: z.string().optional(),
    address: z.string().optional(),
    profile_photo_url: z.string().optional(),

    // Step 4: Specialization (simplified for MVP)
    requested_specialization_ids: z.array(z.number()).optional(),
    primary_specialization_id: z.number().optional(),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });

type Step = 'account' | 'professional' | 'personal' | 'review';

interface DoctorRegisterFormProps {
  onSubmit?: (values: DoctorRegisterFormValues) => void | Promise<void>;
}

export const DoctorRegisterForm: FC<DoctorRegisterFormProps> = ({
  onSubmit,
}) => {
  const [currentStep, setCurrentStep] = useState<Step>('account');
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  /** Guard: only allows submission when the user explicitly clicks Submit Application. */
  const allowSubmitRef = useRef(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    trigger,
  } = useForm<DoctorRegisterFormValues>({
    resolver: zodResolver(doctorRegisterSchema),
    mode: 'onTouched',
    defaultValues: {
      full_name: '',
      email: '',
      password: '',
      confirm_password: '',
      terms_accepted: false,
      qualification: '',
      registration_number: '',
      years_of_experience: undefined,
      primary_phone: '',
      date_of_birth: '',
      gender: '',
      address: '',
    },
  });

  const watchedValues = watch();

  const steps: { key: Step; label: string; number: number }[] = [
    { key: 'account', label: 'Account', number: 1 },
    { key: 'professional', label: 'Professional', number: 2 },
    { key: 'personal', label: 'Personal', number: 3 },
    { key: 'review', label: 'Review', number: 4 },
  ];

  const currentStepIndex = steps.findIndex((s) => s.key === currentStep);

  const validateAndNext = async () => {
    let fieldsToValidate: (keyof DoctorRegisterFormValues)[] = [];

    if (currentStep === 'account') {
      fieldsToValidate = [
        'full_name',
        'email',
        'password',
        'confirm_password',
        'terms_accepted',
      ];
    } else if (currentStep === 'professional') {
      // Professional fields are optional, just move forward
      setCurrentStep('personal');
      return;
    } else if (currentStep === 'personal') {
      setCurrentStep('review');
      return;
    }

    const valid = await trigger(fieldsToValidate);
    if (valid) {
      const nextIndex = currentStepIndex + 1;
      if (nextIndex < steps.length) {
        setCurrentStep(steps[nextIndex].key);
      }
    }
  };

  const goBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex].key);
    }
  };

  const handleFormSubmit = async (values: DoctorRegisterFormValues) => {
    // Only allow submission when the user explicitly clicked Submit Application
    if (!allowSubmitRef.current) return;
    allowSubmitRef.current = false;

    setSubmitError(null);
    setIsLoading(true);
    try {
      if (onSubmit) {
        await onSubmit(values);
      }
    } catch (error) {
      setSubmitError(parseApiError(error).message);
    } finally {
      setIsLoading(false);
    }
  };

  /** Prevent Enter key from triggering form submission on steps 1-3. */
  const handleFormKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
      e.preventDefault();
    }
  };

  return (
    <form
      onSubmit={handleSubmit(handleFormSubmit)}
      onKeyDown={handleFormKeyDown}
      noValidate
      className="flex flex-col gap-5"
    >
      {/* ── Progress Steps ─────────────────────────────── */}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.key} className="flex items-center">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-caption font-medium ${
                index <= currentStepIndex
                  ? 'bg-primary-600 text-white'
                  : 'bg-neutral-200 text-neutral-500'
              }`}
            >
              {step.number}
            </div>
            {index < steps.length - 1 && (
              <div
                className={`ml-2 h-0.5 w-8 ${
                  index < currentStepIndex ? 'bg-primary-600' : 'bg-neutral-200'
                }`}
              />
            )}
          </div>
        ))}
      </div>

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

      {/* ── Step 1: Account ───────────────────────────── */}
      {currentStep === 'account' && (
        <div className="space-y-4">
          <h2 className="text-h4 font-semibold text-neutral-900">
            Account Information
          </h2>

          <Input
            label="Full name"
            type="text"
            placeholder="Dr. Juan Dela Cruz"
            autoComplete="name"
            required
            error={errors.full_name?.message}
            {...register('full_name')}
          />

          <Input
            label="Email address"
            type="email"
            placeholder="name@denscare.clinic"
            autoComplete="email"
            inputMode="email"
            required
            error={errors.email?.message}
            {...register('email')}
          />

          <div className="flex flex-col gap-1.5">
            <PasswordInput
              label="Password"
              placeholder="Create a strong password"
              autoComplete="new-password"
              error={errors.password?.message}
              {...register('password')}
            />
          </div>

          <PasswordInput
            label="Confirm password"
            placeholder="Re-enter your password"
            autoComplete="new-password"
            error={errors.confirm_password?.message}
            {...register('confirm_password')}
          />

          <div>
            <Checkbox
              label={
                <span className="text-body text-neutral-600">
                  I agree to the{' '}
                  <a
                    href="#"
                    className="font-medium text-primary-600 hover:text-primary-700"
                  >
                    Terms of Service
                  </a>{' '}
                  and{' '}
                  <a
                    href="#"
                    className="font-medium text-primary-600 hover:text-primary-700"
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
        </div>
      )}

      {/* ── Step 2: Professional Details ─────────────── */}
      {currentStep === 'professional' && (
        <div className="space-y-4">
          <h2 className="text-h4 font-semibold text-neutral-900">
            Professional Details
          </h2>
          <p className="text-body-sm text-neutral-500">
            These details will be reviewed by the clinic administrator.
          </p>

          <Input
            label="Qualification"
            type="text"
            placeholder="e.g. DMD, DDS"
            error={errors.qualification?.message}
            {...register('qualification')}
          />

          <Input
            label="Registration / License Number"
            type="text"
            placeholder="e.g. DEN-2020-12345"
            error={errors.registration_number?.message}
            {...register('registration_number')}
          />

          <Input
            label="Years of Experience"
            type="number"
            placeholder="e.g. 10"
            min={0}
            max={50}
            error={errors.years_of_experience?.message}
            {...register('years_of_experience', { valueAsNumber: true })}
          />
        </div>
      )}

      {/* ── Step 3: Personal Details ──────────────────── */}
      {currentStep === 'personal' && (
        <div className="space-y-4">
          <h2 className="text-h4 font-semibold text-neutral-900">
            Personal Details
          </h2>

          <Input
            label="Primary Phone"
            type="tel"
            placeholder="+639171234567"
            error={errors.primary_phone?.message}
            {...register('primary_phone')}
          />

          <Input
            label="Date of Birth"
            type="date"
            error={errors.date_of_birth?.message}
            {...register('date_of_birth')}
          />

          <Select
            label="Gender"
            options={[
              { value: '', label: 'Select gender' },
              { value: 'male', label: 'Male' },
              { value: 'female', label: 'Female' },
              { value: 'other', label: 'Other' },
            ]}
            error={errors.gender?.message}
            {...register('gender')}
          />

          <Input
            label="Address"
            type="text"
            placeholder="123 Rizal St., Manila"
            error={errors.address?.message}
            {...register('address')}
          />
        </div>
      )}

      {/* ── Step 4: Review & Submit ───────────────────── */}
      {currentStep === 'review' && (
        <div className="space-y-4">
          <h2 className="text-h4 font-semibold text-neutral-900">
            Review Your Application
          </h2>
          <p className="text-body-sm text-neutral-500">
            Please review your information before submitting.
          </p>

          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 space-y-3">
            <div>
              <p className="text-caption text-neutral-500">Full Name</p>
              <p className="text-body font-medium text-neutral-900">
                {watchedValues.full_name}
              </p>
            </div>
            <div>
              <p className="text-caption text-neutral-500">Email</p>
              <p className="text-body font-medium text-neutral-900">
                {watchedValues.email}
              </p>
            </div>
            {watchedValues.qualification && (
              <div>
                <p className="text-caption text-neutral-500">Qualification</p>
                <p className="text-body font-medium text-neutral-900">
                  {watchedValues.qualification}
                </p>
              </div>
            )}
            {watchedValues.registration_number && (
              <div>
                <p className="text-caption text-neutral-500">
                  Registration Number
                </p>
                <p className="text-body font-medium text-neutral-900">
                  {watchedValues.registration_number}
                </p>
              </div>
            )}
            {watchedValues.primary_phone && (
              <div>
                <p className="text-caption text-neutral-500">Phone</p>
                <p className="text-body font-medium text-neutral-900">
                  {watchedValues.primary_phone}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Navigation Buttons ─────────────────────────── */}
      <div className="flex gap-3">
        {currentStepIndex > 0 && (
          <Button
            type="button"
            variant="secondary"
            onClick={goBack}
            disabled={isLoading}
          >
            Back
          </Button>
        )}

        {currentStep !== 'review' ? (
          <Button
            type="button"
            variant="primary"
            onClick={validateAndNext}
            disabled={isLoading}
            className="flex-1"
          >
            Continue
          </Button>
        ) : (
          <Button
            type="submit"
            variant="primary"
            loading={isLoading}
            disabled={isLoading}
            className="flex-1"
            onMouseDown={() => {
              allowSubmitRef.current = true;
            }}
          >
            {isLoading ? 'Submitting...' : 'Submit Application'}
          </Button>
        )}
      </div>
    </form>
  );
};
