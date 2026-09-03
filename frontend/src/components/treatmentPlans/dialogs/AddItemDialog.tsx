import type { FC } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '../../common/Modal/Modal';
import { Form, FormActions, FormField, ValidationSummary } from '../../common/Form';
import { Select, Textarea } from '../../common/Input';
import { itemFormSchema, defaultItemFormValues } from '../../../utils/itemFormSchema';
import { TOOTH_ARCHES, TOOTH_QUADRANTS, TREATMENT_PLAN_CURRENCY_CODE } from '../../../constants/treatmentPlan';
import { formatCurrency } from '../../../utils/formatting';
import type { ItemFormValues } from '../../../types/treatmentPlan';

interface AddItemDialogProps {
  open: boolean;
  onClose: () => void;
  /** Active procedure options for the dropdown. */
  procedureOptions: { value: string; label: string }[];
  proceduresLoading?: boolean;
  /** procedure_id (string) → default cost — shown as the cost hint (architecture §10). */
  procedureCostMap?: Record<string, number>;
  onSubmit: (values: ItemFormValues) => void;
  submitting?: boolean;
  serverErrors?: Record<string, string>;
  serverMessage?: string | null;
}

/**
 * AddItemDialog — S-04 add-item form ([MAP §6.2]).
 *
 * All fields mirror AddItemRequest bounds: FDI tooth 11–48/51–85, cost
 * 0–999999.99, discount ≤ cost, sequence unique (server 409 on dupes).
 * `estimated_cost` is pre-filled with the selected procedure's default cost
 * as a hint. Tooth-surface is soft-validated only (O8).
 */
export const AddItemDialog: FC<AddItemDialogProps> = ({
  open,
  onClose,
  procedureOptions,
  proceduresLoading = false,
  procedureCostMap = {},
  onSubmit,
  submitting = false,
  serverErrors = {},
  serverMessage = null,
}) => {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ItemFormValues>({
    resolver: zodResolver(itemFormSchema),
    mode: 'onTouched',
    defaultValues: defaultItemFormValues,
  });

  const fieldError = (field: keyof ItemFormValues) =>
    errors[field]?.message ?? serverErrors[field];

  // Cost hint: the selected procedure's default cost (informational only).
  const watchedProcedureId = useWatch({ control, name: 'procedure_id' });
  const defaultCostHint =
    watchedProcedureId && procedureCostMap[watchedProcedureId] != null
      ? formatCurrency(procedureCostMap[watchedProcedureId], TREATMENT_PLAN_CURRENCY_CODE)
      : undefined;

  return (
    <Modal open={open} onClose={onClose} size="lg" ariaLabel="Add plan item">
      <Modal.Header>
        <h2 className="text-h4 font-semibold text-neutral-900">Add Plan Item</h2>
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
          <FormField label="Sequence Number" error={fieldError('sequence_number')}>
            <input
              id="item-sequence"
              type="number"
              min={1}
              step={1}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-body text-neutral-800 transition-colors duration-150 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 hover:border-neutral-400"
              placeholder="1"
              aria-invalid={!!fieldError('sequence_number')}
              {...register('sequence_number')}
            />
          </FormField>

          <FormField label="Quantity" error={fieldError('quantity')} helperText="Number of procedure units">
            <input
              id="item-quantity"
              type="number"
              min={1}
              step={1}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-body text-neutral-800 transition-colors duration-150 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 hover:border-neutral-400"
              aria-invalid={!!fieldError('quantity')}
              {...register('quantity')}
            />
          </FormField>

          <FormField label="Tooth Number" error={fieldError('tooth_number')}>
            <input
              id="item-tooth"
              type="number"
              min={11}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-body text-neutral-800 transition-colors duration-150 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 hover:border-neutral-400"
              placeholder="FDI 11–48 / 51–85"
              aria-invalid={!!fieldError('tooth_number')}
              {...register('tooth_number')}
            />
          </FormField>

          <FormField label="Tooth Surface" error={fieldError('tooth_surface')}>
            <input
              id="item-surface"
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-body text-neutral-800 transition-colors duration-150 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 hover:border-neutral-400"
              placeholder="e.g. MOD"
              maxLength={10}
              aria-invalid={!!fieldError('tooth_surface')}
              {...register('tooth_surface')}
            />
          </FormField>

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

          <FormField label="Unit Cost" error={fieldError('estimated_cost')}>
            <input
              id="item-cost"
              type="number"
              min={0}
              step="0.01"
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-body text-neutral-800 transition-colors duration-150 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 hover:border-neutral-400"
              placeholder={defaultCostHint ? `${defaultCostHint}` : '0.00'}
              aria-invalid={!!fieldError('estimated_cost')}
              {...register('estimated_cost')}
            />
          </FormField>

          <FormField label="Discount" error={fieldError('discount')}>
            <input
              id="item-discount"
              type="number"
              min={0}
              step="0.01"
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-body text-neutral-800 transition-colors duration-150 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 hover:border-neutral-400"
              placeholder="0.00"
              aria-invalid={!!fieldError('discount')}
              {...register('discount')}
            />
          </FormField>

          <div className="md:col-span-2">
            <Textarea
              label="Notes"
              placeholder="Optional notes for this item…"
              maxLength={5000}
              error={fieldError('notes')}
              {...register('notes')}
            />
          </div>

          <FormActions
            onCancel={onClose}
            submitting={submitting}
            submitText="Add Item"
            className="md:col-span-2"
          />
        </Form>
      </Modal.Body>
    </Modal>
  );
};
