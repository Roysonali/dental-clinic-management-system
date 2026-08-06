import { useState, type FC } from 'react';
import { DoctorDrawer } from '../DoctorDrawer';
import {
  useCreateDoctor,
  useUpdateDoctor,
} from '../../../hooks/doctors/useDoctorMutations';
import { useDoctor } from '../../../hooks/doctors/useDoctor';
import {
  createPayloadFromForm,
  responseToFormValues,
  updatePayloadFromForm,
} from '../../../utils/doctorFormUtils';
import { parseApiError } from '../../../services/apiError';
import type { DoctorFormValues, DoctorResponse } from '../../../types/doctor';

interface DoctorFormContainerProps {
  /** Drawer open state */
  open: boolean;
  /** Create vs edit mode */
  mode: 'create' | 'edit';
  /** Doctor id to edit (edit mode); the full record is fetched on open */
  doctorId?: string | null;
  /** Called to close the drawer */
  onClose: () => void;
  /** Called after a successful create (typically to refresh the list) */
  onCreated?: (doctor: DoctorResponse) => void;
}

/**
 * DoctorFormContainer — orchestrates the create/edit drawer.
 *
 * Owns submission, loading, server-error mapping and the mutations; the
 * presentational DoctorForm/DoctorDrawer stay pure. Both Create and Edit
 * flow through this single container — no duplicated form logic.
 */
export const DoctorFormContainer: FC<DoctorFormContainerProps> = ({
  open,
  mode,
  doctorId,
  onClose,
  onCreated,
}) => {
  const createMutation = useCreateDoctor();
  const updateMutation = useUpdateDoctor();

  // Edit mode fetches the full doctor record when the drawer opens.
  const doctorQuery = useDoctor(doctorId, open && mode === 'edit');

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

  const handleSubmit = (values: DoctorFormValues) => {
    setServerMessage(null);
    setServerErrors({});

    if (isEdit && doctorId) {
      // Pass the fetched record as the PATCH baseline so cleared optional
      // fields are sent as explicit `null` (F3: users can remove previously
      // populated optional info) while unchanged fields stay omitted.
      updateMutation.mutate(
        {
          id: doctorId,
          payload: updatePayloadFromForm(values, doctorQuery.data),
        },
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

    createMutation.mutate(createPayloadFromForm(values), {
      onSuccess: (doctor) => {
        onClose();
        onCreated?.(doctor);
      },
      onError: (error) => {
        const info = parseApiError(error);
        setServerMessage(info.message);
        setServerErrors(info.fieldErrors);
      },
    });
  };

  return (
    <DoctorDrawer
      open={open}
      mode={mode}
      onClose={handleClose}
      onSubmit={handleSubmit}
      submitting={submitting}
      loading={isEdit && doctorQuery.isLoading}
      // Disable editing when the baseline fetch is still loading OR errored:
      // without the fetched record, PATCH nullability (F3) cannot be applied
      // and a submit would silently fall back to legacy omit-empties.
      disabled={isEdit && (doctorQuery.isLoading || doctorQuery.isError)}
      initialValues={doctorQuery.data ? responseToFormValues(doctorQuery.data) : undefined}
      serverMessage={serverMessage}
      serverErrors={serverErrors}
    />
  );
};
