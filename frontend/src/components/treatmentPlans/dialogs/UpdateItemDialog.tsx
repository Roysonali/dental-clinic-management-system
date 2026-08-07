import type { FC } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '../../common/Modal/Modal';
import { Form, FormActions, ValidationSummary } from '../../common/Form';
import { Select, Textarea } from '../../common/Input';
import { itemFormSchema } from '../../../utils/itemFormSchema';
import { itemResponseToFormValues } from '../itemFormUtils';
import { TOOTH_ARCHES, TOOTH_QUADRANTS } from '../../../constants/treatmentPlan';
import type { ItemFormValues, TreatmentPlanItemResponse } from '../../../types/treatmentPlan';

interface UpdateItemDialogProps {
  open: boolean;
  onClose: () => void;
  item: TreatmentPlanItemResponse | null;
  procedureOptions: { value: string; label: string }[];
  proceduresLoading?: boolean;
  onSubmit: (values: ItemFormValues) => void;
  submitting?: boolean;
  serverErrors?: Record<string, string>;
  serverMessage?: string | null;
}

/**
 * UpdateItemDialog — S-04 edit-item form ([MAP §6.3]).
 *
 * Partial-update semantics: only changed fields are sent (via
 * `itemFormValuesToUpdateRequest` in the container). NOTE the notes quirk
 * (R14): `""` is invalid to the backend and `null` is ignored — there is no
 * "clear notes" affordance; the field is simply omitted when untouched.
 */
export const UpdateItemDialog: FC<UpdateItemDialogProps> = ({
  open,
  onClose,
  item,
  procedureOptions,
  proceduresLoading = false,
  onSubmit,
  submitting = false,
  serverErrors = {},
  serverMessage = null,
}) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ItemFormValues>({
    resolver: zodResolver(itemFormSchema),
    mode: 'onTouched',
    values: item ? itemResponseToFormValues(item) : undefined,
  });

  const fieldError = (field: keyof ItemFormValues) =>
    errors[field]?.message ?? serverErrors[field];

  return (
    <Modal open={open} onClose={onClose} size="lg" ariaLabel="Update plan item">
      <Modal.Header>
        <h2 className="text-h4 font-semibold text-neutral-900">
          Update Item {item ? `#${item.sequence_number}` : ''}
        </h2>
      </Modal.Header>
      <Modal.Body>
        {serverMessage && (
          <div role="alert" className="mb-4 rounded-lg border border-danger/25 bg-danger/10 p-4">
            <p className="text-body-sm text-danger">{serverMessage}</p>
          </div>
        )}
        <ValidationSummary errors={errors} title="Please review the following fields:" />

        <Form grid columns={2} spacing="md" onSubmit={handleSubmit(onSubmit)}>
          <Select
            label="Procedure"
            required
            placeholder={proceduresLoading ? 'Loading procedures…' : 'Select procedure'}
            disabled={proceduresLoading}
            options={procedureOptions}
            error={fieldError('procedure_id')}
            {...register('procedure_id')}
          />
          <input
            id="update-item-sequence"
            type="number"
            min={1}
            step={1}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-body text-neutral-800 transition-colors duration-150 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 hover:border-neutral-400"
            placeholder="Sequence number"
            aria-invalid={!!fieldError('sequence_number')}
            {...register('sequence_number')}
          />
          {fieldError('sequence_number') && (
            <p id="update-item-sequence-error" className="mt-1 text-body-sm text-danger">
              {fieldError('sequence_number')}
            </p>
          )}

          <input
            id="update-item-tooth"
            type="number"
            min={11}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-body text-neutral-800 transition-colors duration-150 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 hover:border-neutral-400"
            placeholder="Tooth number (FDI 11–48 / 51–85)"
            aria-invalid={!!fieldError('tooth_number')}
            {...register('tooth_number')}
          />
          {fieldError('tooth_number') && (
            <p id="update-item-tooth-error" className="mt-1 text-body-sm text-danger">
              {fieldError('tooth_number')}
            </p>
          )}

          <input
            id="update-item-surface"
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-body text-neutral-800 transition-colors duration-150 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 hover:border-neutral-400"
            placeholder="Tooth surface (e.g. MOD)"
            maxLength={10}
            aria-invalid={!!fieldError('tooth_surface')}
            {...register('tooth_surface')}
          />
          {fieldError('tooth_surface') && (
            <p id="update-item-surface-error" className="mt-1 text-body-sm text-danger">
              {fieldError('tooth_surface')}
            </p>
          )}

          <Select
            label="Quadrant"
            placeholder="None"
            options={TOOTH_QUADRANTS.map((q) => ({ value: q, label: q }))}
            error={fieldError('quadrant')}
            {...register('quadrant')}
          />
          <Select
            label="Arch"
            placeholder="None"
            options={TOOTH_ARCHES.map((a) => ({ value: a, label: a === 'upper' ? 'Upper' : 'Lower' }))}
            error={fieldError('arch')}
            {...register('arch')}
          />

          <input
            id="update-item-cost"
            type="number"
            min={0}
            step="0.01"
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-body text-neutral-800 transition-colors duration-150 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 hover:border-neutral-400"
            placeholder="Estimated cost"
            aria-invalid={!!fieldError('estimated_cost')}
            {...register('estimated_cost')}
          />
          {fieldError('estimated_cost') && (
            <p id="update-item-cost-error" className="mt-1 text-body-sm text-danger">
              {fieldError('estimated_cost')}
            </p>
          )}

          <input
            id="update-item-discount"
            type="number"
            min={0}
            step="0.01"
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-body text-neutral-800 transition-colors duration-150 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 hover:border-neutral-400"
            placeholder="Discount"
            aria-invalid={!!fieldError('discount')}
            {...register('discount')}
          />
          {fieldError('discount') && (
            <p id="update-item-discount-error" className="mt-1 text-body-sm text-danger">
              {fieldError('discount')}
            </p>
          )}

          <div className="md:col-span-2">
            <Textarea
              label="Notes"
              placeholder="Optional notes for this item…"
              maxLength={5000}
              helperText="Leave untouched to keep the current notes."
              error={fieldError('notes')}
              {...register('notes')}
            />
          </div>

          <FormActions
            onCancel={onClose}
            submitting={submitting}
            submitText="Save Changes"
            className="md:col-span-2"
          />
        </Form>
      </Modal.Body>
    </Modal>
  );
};
