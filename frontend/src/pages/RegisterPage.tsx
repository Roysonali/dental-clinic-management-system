import { useState, type FC } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout';
import { RegisterForm } from '../components/auth/forms/RegisterForm';
import { DoctorRegisterForm } from '../components/auth/forms/DoctorRegisterForm';
import { Divider } from '../components/common/Divider';
import { Alert } from '../components/common/Alert/Alert';
import { authService } from '../services/authService';
import { ROUTES } from '../routes/routes';
import type { RegisterFormValues, DoctorRegisterFormValues, ApplicationType } from '../types/auth';

/**
 * Registration page — new clinic account request.
 *
 * Supports two application paths:
 * 1. Staff: Existing flow — `{ full_name, email, password }` to POST /auth/register.
 * 2. Doctor: New flow — POST /auth/register-doctor with professional details.
 *
 * Route: /auth/register
 */
const RegisterPage: FC = () => {
  const [registered, setRegistered] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [applicationType, setApplicationType] = useState<ApplicationType | null>(null);

  const handleStaffSubmit = async (values: RegisterFormValues) => {
    const response = await authService.register({
      full_name: values.full_name,
      email: values.email,
      password: values.password,
    });
    setSuccessMessage(response.message);
    setRegistered(true);
  };

  const handleDoctorSubmit = async (values: DoctorRegisterFormValues) => {
    // Clean up empty strings → undefined so the backend receives null/not-sent
    // for optional fields like date_of_birth, gender, primary_phone, etc.
    const clean = (v: string | undefined) => (v && v.trim() !== '' ? v.trim() : undefined);
    const response = await authService.registerDoctor({
      full_name: values.full_name,
      email: values.email,
      password: values.password,
      qualification: clean(values.qualification),
      registration_number: clean(values.registration_number),
      years_of_experience: values.years_of_experience || undefined,
      date_of_birth: clean(values.date_of_birth),
      gender: clean(values.gender) as 'male' | 'female' | 'other' | undefined,
      primary_phone: clean(values.primary_phone),
      address: clean(values.address),
      profile_photo_url: clean(values.profile_photo_url),
      requested_specialization_ids: values.requested_specialization_ids?.length ? values.requested_specialization_ids : undefined,
      primary_specialization_id: values.primary_specialization_id || undefined,
    });
    setSuccessMessage(response.message);
    setRegistered(true);
  };

  if (registered) {
    return (
      <AuthLayout sectionLabel="Registration submitted">
        <div className="text-center sm:text-left">
          <h1 className="text-h2 font-semibold text-neutral-900">
            Request submitted
          </h1>
          <p className="mt-2 text-body text-neutral-500">
            {applicationType === 'doctor'
              ? 'Your doctor application has been submitted.'
              : 'Thank you for requesting clinic access.'}
          </p>
        </div>

        <Alert
          variant="success"
          title="Registration received"
          description={
            successMessage ||
            'Your account is pending administrator approval. You will be able to sign in once approved.'
          }
        />

        <div className="space-y-4">
          <p className="text-center text-body text-neutral-600">
            Once your account is approved, you can{' '}
            <Link
              to={ROUTES.AUTH.LOGIN}
              className="font-medium text-primary-600 hover:text-primary-700 transition-colors duration-150"
            >
              sign in
            </Link>{' '}
            to access the workspace.
          </p>

          <Divider />

          <p className="text-center">
            <Link
              to={ROUTES.AUTH.LOGIN}
              className="inline-flex items-center gap-1.5 text-caption text-neutral-500 hover:text-neutral-700 transition-colors duration-150"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M9.5 2.5L2.5 9.5M2.5 9.5H8M2.5 9.5V4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Back to sign in
            </Link>
          </p>
        </div>
      </AuthLayout>
    );
  }

  // Step 1: Choose application type
  if (!applicationType) {
    return (
      <AuthLayout sectionLabel="Create an account">
        <div className="text-center sm:text-left">
          <h1 className="text-h2 font-semibold text-neutral-900">
            Create an account
          </h1>
          <p className="mt-2 text-body text-neutral-500">
            What are you applying as?
          </p>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setApplicationType('staff')}
            className="w-full rounded-lg border border-neutral-200 bg-white p-4 text-left transition-colors duration-150 hover:border-primary-300 hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <div>
                <p className="text-body font-medium text-neutral-900">Staff</p>
                <p className="text-caption text-neutral-500">
                  Receptionist, dental assistant, or other clinic staff
                </p>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setApplicationType('doctor')}
            className="w-full rounded-lg border border-neutral-200 bg-white p-4 text-left transition-colors duration-150 hover:border-primary-300 hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </div>
              <div>
                <p className="text-body font-medium text-neutral-900">Doctor</p>
                <p className="text-caption text-neutral-500">
                  Dentist or dental specialist
                </p>
              </div>
            </div>
          </button>
        </div>

        <div className="space-y-4">
          <Divider />
          <p className="text-center text-body text-neutral-600">
            Already have an account?{' '}
            <Link
              to={ROUTES.AUTH.LOGIN}
              className="font-medium text-primary-600 hover:text-primary-700 transition-colors duration-150"
            >
              Sign in
            </Link>
          </p>
        </div>
      </AuthLayout>
    );
  }

  // Step 2a: Staff registration (existing flow)
  if (applicationType === 'staff') {
    return (
      <AuthLayout sectionLabel="Staff registration">
        <div className="text-center sm:text-left">
          <h1 className="text-h2 font-semibold text-neutral-900">
            Staff registration
          </h1>
          <p className="mt-2 text-body text-neutral-500">
            Fill in your details to request clinic access.
          </p>
        </div>

        <RegisterForm onSubmit={handleStaffSubmit} />

        <div className="space-y-4">
          <p className="text-center text-body text-neutral-600">
            Already have an account?{' '}
            <Link
              to={ROUTES.AUTH.LOGIN}
              className="font-medium text-primary-600 hover:text-primary-700 transition-colors duration-150"
            >
              Sign in
            </Link>
          </p>

          <Divider />

          <p className="text-center">
            <button
              type="button"
              onClick={() => setApplicationType(null)}
              className="inline-flex items-center gap-1.5 text-caption text-neutral-500 hover:text-neutral-700 transition-colors duration-150"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M9.5 2.5L2.5 9.5M2.5 9.5H8M2.5 9.5V4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Back to selection
            </button>
          </p>
        </div>
      </AuthLayout>
    );
  }

  // Step 2b: Doctor registration (new multi-step flow)
  return (
    <AuthLayout sectionLabel="Doctor application">
      <div className="text-center sm:text-left">
        <h1 className="text-h2 font-semibold text-neutral-900">
          Doctor application
        </h1>
        <p className="mt-2 text-body text-neutral-500">
          Submit your professional details for clinic review.
        </p>
      </div>

      <DoctorRegisterForm onSubmit={handleDoctorSubmit} />

      <div className="space-y-4">
        <Divider />
        <p className="text-center">
          <button
            type="button"
            onClick={() => setApplicationType(null)}
            className="inline-flex items-center gap-1.5 text-caption text-neutral-500 hover:text-neutral-700 transition-colors duration-150"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M9.5 2.5L2.5 9.5M2.5 9.5H8M2.5 9.5V4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Back to selection
          </button>
        </p>
      </div>
    </AuthLayout>
  );
};

export default RegisterPage;
