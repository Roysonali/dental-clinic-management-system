import { useEffect, type FC } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Drawer } from '../../common/Drawer/Drawer';
import { IconButton } from '../../common/Button/IconButton';
import { Icon } from '../../common/Icon/Icon';
import { Button } from '../../common/Button/Button';
import { Form, FormActions, ValidationSummary } from '../../common/Form';
import { Input, Textarea } from '../../common/Input';
import {
  defaultPrescriptionFormValues,
  emptyPrescriptionItem,
  prescriptionFormSchema,
} from '../../../utils/patientRecordFormSchema';
import {
  MEDICINE_INSTRUCTIONS_MAX,
  MEDICINE_NAME_MAX,
  MEDICINE_TEXT_MAX,
  PRESCRIPTION_MAX_ITEMS,
  PRESCRIPTION_NOTES_MAX,
} from '../../../constants/patientRecord';
import type { PrescriptionFormValues } from '../../../types/patientRecord';

interface PrescriptionCreateDrawerProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: PrescriptionFormValues) => void;
  submitting?: boolean;
  serverErrors?: Record<string, string>;
  serverMessage?: string | null;
}

/**
 * PrescriptionCreateDrawer — S-10 create prescription ([UI spec S-10]).
 *
 * 640px drawer: notes (≤ 3000) + a dynamic item editor with 1–20 rows
 * (medicine_name 2–255, dosage/frequency/duration 1–100, instructions
 * ≤ 2000). "Add medicine" appends a row (disabled at 20); rows can be
 * removed down to 1. Submit POSTs `{notes, items}` atomically. No
 * approval/print/refill/status — the backend has none of those.
 */
export const PrescriptionCreateDrawer: FC<PrescriptionCreateDrawerProps> = ({
  open,
  onClose,
  onSubmit,
  submitting = false,
  serverErrors = {},
  serverMessage = null,
}) => {
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<PrescriptionFormValues>({
    resolver: zodResolver(prescriptionFormSchema),
    mode: 'onTouched',
    defaultValues: defaultPrescriptionFormValues,
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  // M-1: re-seed a clean form on every open — resets values, validation
  // errors, dirty/touched flags AND the dynamic item array back to one
  // empty medicine row.
  useEffect(() => {
    if (open) reset(defaultPrescriptionFormValues);
  }, [open, reset]);

  const fieldError = (field: 'notes' | 'items') => errors[field]?.message ?? serverErrors[field];

  /**
   * Server-side nested validation error for a medicine row (e.g. a 422 with
   * `loc: ["body","items",2,"medicine_name"]` surfaces as
   * `serverErrors["items.2.medicine_name"]`) — mapped to the exact row+field.
   */
  const itemServerError = (index: number, field: string): string | undefined =>
    serverErrors[`items.${index}.${field}`];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      position="right"
      size="lg"
      ariaLabel="Create Prescription"
      className="!max-w-[680px]"
    >
      <Drawer.Header>
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-h3 font-semibold tracking-tight text-neutral-900">
              Create Prescription
            </h2>
            <p className="text-caption text-neutral-500">
              1–20 medicines, saved atomically in one transaction.
            </p>
          </div>
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
        {serverMessage && (
          <div role="alert" className="mb-4 rounded-lg border border-danger/25 bg-danger/10 p-4">
            <p className="text-body-sm text-danger">{serverMessage}</p>
          </div>
        )}
        <ValidationSummary errors={errors} title="Please review the following fields:" />

        <Form grid columns={1} spacing="md" onSubmit={handleSubmit(onSubmit)}>
          <Textarea
            label="Notes"
            placeholder="General prescription notes…"
            maxLength={PRESCRIPTION_NOTES_MAX}
            showCharCount
            autoResize
            error={fieldError('notes')}
            {...register('notes')}
          />

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-label font-medium text-neutral-700">
                Medicines{' '}
                <span className="text-neutral-400">
                  ({fields.length}/{PRESCRIPTION_MAX_ITEMS})
                </span>
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ ...emptyPrescriptionItem })}
                disabled={fields.length >= PRESCRIPTION_MAX_ITEMS}
                leftIcon={<Icon icon={Plus} size="xs" />}
              >
                Add Medicine
              </Button>
            </div>

            {(typeof errors.items?.message === 'string' || serverErrors['items']) && (
              <p className="text-body-sm text-danger">
                {errors.items?.message ?? serverErrors['items']}
              </p>
            )}

            <div className="flex flex-col gap-3">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="rounded-lg border border-neutral-200 bg-neutral-50/40 p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-caption font-semibold uppercase tracking-wide text-neutral-500">
                      Medicine {index + 1}
                    </span>
                    <IconButton
                      icon={<Icon icon={Trash2} size="sm" />}
                      aria-label={`Remove medicine ${index + 1}`}
                      variant="ghost"
                      size="sm"
                      disabled={fields.length <= 1}
                      className="text-danger hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={() => remove(index)}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <Controller
                      control={control}
                      name={`items.${index}.medicine_name`}
                      render={({ field: itemField }) => (
                        <Input
                          label="Medicine Name"
                          required
                          maxLength={MEDICINE_NAME_MAX}
                          placeholder="e.g. Amoxicillin"
                          error={
                            errors.items?.[index]?.medicine_name?.message ??
                            itemServerError(index, 'medicine_name')
                          }
                          {...itemField}
                        />
                      )}
                    />
                    <Controller
                      control={control}
                      name={`items.${index}.dosage`}
                      render={({ field: itemField }) => (
                        <Input
                          label="Dosage"
                          required
                          maxLength={MEDICINE_TEXT_MAX}
                          placeholder="e.g. 500mg"
                          error={
                            errors.items?.[index]?.dosage?.message ?? itemServerError(index, 'dosage')
                          }
                          {...itemField}
                        />
                      )}
                    />
                    <Controller
                      control={control}
                      name={`items.${index}.frequency`}
                      render={({ field: itemField }) => (
                        <Input
                          label="Frequency"
                          required
                          maxLength={MEDICINE_TEXT_MAX}
                          placeholder="e.g. TDS"
                          error={
                            errors.items?.[index]?.frequency?.message ??
                            itemServerError(index, 'frequency')
                          }
                          {...itemField}
                        />
                      )}
                    />
                    <Controller
                      control={control}
                      name={`items.${index}.duration`}
                      render={({ field: itemField }) => (
                        <Input
                          label="Duration"
                          required
                          maxLength={MEDICINE_TEXT_MAX}
                          placeholder="e.g. 5 days"
                          error={
                            errors.items?.[index]?.duration?.message ?? itemServerError(index, 'duration')
                          }
                          {...itemField}
                        />
                      )}
                    />
                    <div className="md:col-span-2">
                      <Controller
                        control={control}
                        name={`items.${index}.instructions`}
                        render={({ field: itemField }) => (
                          <Textarea
                            label="Instructions"
                            maxLength={MEDICINE_INSTRUCTIONS_MAX}
                            showCharCount
                            autoResize
                            placeholder="e.g. Take after meals"
                            error={
                              errors.items?.[index]?.instructions?.message ??
                              itemServerError(index, 'instructions')
                            }
                            {...itemField}
                          />
                        )}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <FormActions
            onCancel={onClose}
            submitting={submitting}
            submitText="Create Prescription"
            cancelDisabled={submitting}
          />
        </Form>
      </Drawer.Body>
    </Drawer>
  );
};
