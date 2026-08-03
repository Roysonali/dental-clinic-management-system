import { useState, type FC } from 'react';
import { PatientDrawer } from '../PatientDrawer';
import { useCreatePatient, useUpdatePatient } from '../../../hooks/patients/usePatientMutations';
import { usePatient } from '../../../hooks/patients/usePatient';
import { patientToFormValues, formValuesToCreatePayload, formValuesToUpdatePayload } from '../patientFormUtils';
import { parseApiError } from '../../../services/apiError';
import type { PatientFormValues, PatientResponse } from '../../../types/patient';

interface PatientFormContainerProps {
  /** Drawer open state */
  open: boolean;
  /** Create vs edit mode */
  mode: 'create' | 'edit';
  /** Patient id to edit (edit mode); the full record is fetched on open */
  patientId?: string | null;
  /** Called to close the drawer */
  onClose: () => void;
  /** Called after a successful create (typically to navigate to the new record) */
  onCreated?: (patient: PatientResponse) => void;
}

/**
 * PatientFormContainer — orchestrates the create/edit drawer.
 *
 * Owns submission, loading, server-error mapping and the mutations; the
 * presentational PatientForm/PatientDrawer stay pure. Both Create and Edit
 * flow through this single container — no duplicated form logic.
 */
export const PatientFormContainer: FC<PatientFormContainerProps> = ({
  open,
  mode,
  patientId,
  onClose,
  onCreated,
}) => {
  const createMutation = useCreatePatient();
  const updateMutation = useUpdatePatient();

  // Edit mode fetches the full patient record when the drawer opens.
  const patientQuery = usePatient(patientId, open && mode === 'edit');

  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});

  // Clear transient server errors whenever the drawer closes so a failed
  // submit never lingers into the next open cycle.
  const handleClose = () => {
    setServerMessage(null);
    setServerErrors({});
    onClose();
  };

  const isEdit = mode === 'edit';
  const submitting = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (values: PatientFormValues) => {
    setServerMessage(null);
    setServerErrors({});

    if (isEdit && patientId) {
      updateMutation.mutate(
        { id: patientId, payload: formValuesToUpdatePayload(values) },
        {
          onSuccess: () => onClose(),
          onError: (error) => {
            const info = parseApiError(error);
            setServerMessage(info.message);
            setServerErrors(info.fieldErrors);
          },
        },
      );
      return;
    }

    createMutation.mutate(formValuesToCreatePayload(values), {
      onSuccess: (patient) => {
        onClose();
        onCreated?.(patient);
      },
      onError: (error) => {
        const info = parseApiError(error);
        setServerMessage(info.message);
        setServerErrors(info.fieldErrors);
      },
    });
  };

  return (
    <PatientDrawer
      open={open}
      mode={mode}
      onClose={handleClose}
      onSubmit={handleSubmit}
      submitting={submitting}
      loading={isEdit && patientQuery.isLoading}
      disabled={isEdit && patientQuery.isLoading}
      initialValues={patientQuery.data ? patientToFormValues(patientQuery.data) : undefined}
      serverMessage={serverMessage}
      serverErrors={serverErrors}
    />
  );
};
