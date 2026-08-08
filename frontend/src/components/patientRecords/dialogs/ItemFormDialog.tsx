import { useEffect, type FC } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '../../common/Modal/Modal';
import { Button } from '../../common/Button/Button';
import { Form, ValidationSummary } from '../../common/Form';
import { Input, Textarea } from '../../common/Input';
import { prescriptionItemFormSchema } from '../../../utils/patientRecordFormSchema';
import {
  MEDICINE_INSTRUCTIONS_MAX,
  MEDICINE_NAME_MAX,
  MEDICINE_TEXT_MAX,
} from '../../../constants/patientRecord';
import type {
  PrescriptionItemFormValues,
  PrescriptionItemResponse,
} from '../../../types/patientRecord';

interface ItemFormDialogProps {
  open: boolean;
  /** Null → create mode; set → edit mode. */
  item: PrescriptionItemResponse | null;
  submitting?: boolean;
  serverErrors?: Record<string, string>;
  serverMessage?: string | null;
  onSubmit: (values: PrescriptionItemFormValues) => void;
  onClose: () => void;
}

function itemToFormValues(item: PrescriptionItemResponse): PrescriptionItemFormValues {
  return {
    medicine_name: item.medicine_name,
    dosage: item.dosage,
    frequency: item.frequency,
    duration: item.duration,
    instructions: item.instructions ?? '',
  };
}

const emptyValues: PrescriptionItemFormValues = {
  medicine_name: '',
  dosage: '',
  frequency: '',
  duration: '',
  instructions: '',
};

/**
 * ItemFormDialog — create/edit a prescription medicine item ([UI spec S-11]).
 *
 * Fields mirror `PrescriptionItemCreate`/`PrescriptionItemUpdate` exactly.
 */
export const ItemFormDialog: FC<ItemFormDialogProps> = ({
  open,
  item,
  submitting = false,
  serverErrors = {},
  serverMessage = null,
  onSubmit,
  onClose,
}) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PrescriptionItemFormValues>({
    resolver: zodResolver(prescriptionItemFormSchema),
    mode: 'onTouched',
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (open) reset(item ? itemToFormValues(item) : emptyValues);
  }, [open, item, reset]);

  const fieldError = (field: keyof PrescriptionItemFormValues) =>
    errors[field]?.message ?? serverErrors[field];

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      ariaLabel={item ? 'Edit medicine' : 'Add medicine'}
    >
      <Modal.Header>
        <h2 className="text-h4 font-semibold tracking-tight text-neutral-900">
          {item ? 'Edit Medicine' : 'Add Medicine'}
        </h2>
      </Modal.Header>
      <Modal.Body>
        {serverMessage && (
          <div role="alert" className="mb-4 rounded-lg border border-danger/25 bg-danger/10 p-4">
            <p className="text-body-sm text-danger">{serverMessage}</p>
          </div>
        )}
        <ValidationSummary errors={errors} title="Please review the following fields:" />

        <Form grid columns={1} spacing="md" onSubmit={handleSubmit(onSubmit)}>
          <Input
            label="Medicine Name"
            required
            maxLength={MEDICINE_NAME_MAX}
            placeholder="e.g. Amoxicillin"
            error={fieldError('medicine_name')}
            {...register('medicine_name')}
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Input
              label="Dosage"
              required
              maxLength={MEDICINE_TEXT_MAX}
              placeholder="e.g. 500mg"
              error={fieldError('dosage')}
              {...register('dosage')}
            />
            <Input
              label="Frequency"
              required
              maxLength={MEDICINE_TEXT_MAX}
              placeholder="e.g. TDS"
              error={fieldError('frequency')}
              {...register('frequency')}
            />
            <Input
              label="Duration"
              required
              maxLength={MEDICINE_TEXT_MAX}
              placeholder="e.g. 5 days"
              error={fieldError('duration')}
              {...register('duration')}
            />
          </div>
          <Textarea
            label="Instructions"
            maxLength={MEDICINE_INSTRUCTIONS_MAX}
            showCharCount
            autoResize
            placeholder="e.g. Take after meals"
            error={fieldError('instructions')}
            {...register('instructions')}
          />
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button variant="primary" loading={submitting} onClick={handleSubmit(onSubmit)}>
          {item ? 'Save Changes' : 'Add Medicine'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
