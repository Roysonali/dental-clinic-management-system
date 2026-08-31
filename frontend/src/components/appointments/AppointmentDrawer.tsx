import type { FC } from 'react';
import { X } from 'lucide-react';
import { Drawer } from '../common/Drawer/Drawer';
import { IconButton } from '../common/Button/IconButton';
import { Icon } from '../common/Icon/Icon';
import { AppointmentForm } from './AppointmentForm';
import { Spinner } from '../common/Spinner/Spinner';
import type { AppointmentFormValues } from '../../types/appointment';
import type { DoctorResponse } from '../../types/doctor';

interface AppointmentDrawerProps {
  /** Open state */
  open: boolean;
  /** Called when the drawer should close */
  onClose: () => void;
  /** Create vs edit mode */
  mode: 'create' | 'edit';
  /** Called with validated form values */
  onSubmit: (values: AppointmentFormValues) => void;
  /** Show loading on the submit button */
  submitting?: boolean;
  /** Pre-fill values (edit mode) */
  initialValues?: Partial<AppointmentFormValues>;
  /** Server-side field errors */
  serverErrors?: Record<string, string>;
  /** Server-level error banner message */
  serverMessage?: string | null;
  /** Show a loading state instead of the form (e.g. fetching the appointment) */
  loading?: boolean;
  /** Disable the form (e.g. while initial data loads) */
  disabled?: boolean;
  /** Dentist dropdown options */
  dentistOptions: { value: string; label: string }[];
  /** Dentists still loading */
  dentistsLoading?: boolean;
  /** Dentists failed to load */
  dentistsError?: boolean;
  /** Whether the patient can be changed */
  patientEditable: boolean;
  /** Patient display name for the fixed-patient label (edit mode) */
  patientName?: string | null;
  /** Full doctor records for date-specific availability checking */
  doctorListItems?: DoctorResponse[];
}

/**
 * AppointmentDrawer — right-side drawer that hosts the shared AppointmentForm.
 *
 * One drawer serves BOTH create and edit — the container decides the mode.
 * Reuses the Drawer primitive (focus trap, Escape, focus restoration) and the
 * presentational AppointmentForm (react-hook-form + zod).
 */
export const AppointmentDrawer: FC<AppointmentDrawerProps> = ({
  open,
  onClose,
  mode,
  onSubmit,
  submitting = false,
  initialValues,
  serverErrors = {},
  serverMessage = null,
  loading = false,
  disabled = false,
  dentistOptions,
  dentistsLoading = false,
  dentistsError = false,
  patientEditable,
  patientName,
  doctorListItems,
}) => {
  const title = mode === 'edit' ? 'Edit Appointment' : 'New Appointment';
  const submitText = mode === 'edit' ? 'Save Changes' : 'Schedule Appointment';

  return (
    <Drawer
      open={open}
      onClose={onClose}
      position="right"
      size="lg"
      ariaLabel={title}
    >
      <Drawer.Header>
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-h4 font-semibold text-neutral-900">{title}</h2>
          <IconButton
            icon={<Icon icon={X} size="sm" />}
            aria-label="Close"
            variant="ghost"
            size="sm"
            onClick={onClose}
          />
        </div>
      </Drawer.Header>

      <Drawer.Body>
        {loading ? (
          <div
            className="flex h-full items-center justify-center py-16"
            role="status"
            aria-label="Loading appointment"
          >
            <Spinner size="lg" variant="primary" />
          </div>
        ) : (
          <AppointmentForm
            onSubmit={onSubmit}
            submitting={submitting}
            submitText={submitText}
            onCancel={onClose}
            initialValues={initialValues}
            serverErrors={serverErrors}
            serverMessage={serverMessage}
            disabled={disabled}
            dentistOptions={dentistOptions}
            dentistsLoading={dentistsLoading}
            dentistsError={dentistsError}
            patientEditable={patientEditable}
            patientName={patientName}
            doctorListItems={doctorListItems}
          />
        )}
      </Drawer.Body>
    </Drawer>
  );
};
