import type { FC } from 'react';
import { X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Drawer } from '../common/Drawer/Drawer';
import { IconButton } from '../common/Button/IconButton';
import { Icon } from '../common/Icon/Icon';
import { Form, FormActions, ValidationSummary } from '../common/Form';
import { Select } from '../common/Input';
import { Spinner } from '../common/Spinner/Spinner';
import {
  procedureFormSchema,
  defaultProcedureFormValues,
} from '../../utils/procedureFormSchema';
import { PROCEDURE_CATEGORIES, PROCEDURE_CATEGORY_LABELS } from '../../constants/procedure';
import type { ProcedureFormValues } from '../../types/procedure';

interface ProcedureFormDialogProps {
  open: boolean;
  onClose: () => void;
  /** Create vs edit mode. */
  mode: 'create' | 'edit';
  /** Edit mode: loading the procedure (drawer skeleton). */
  loading?: boolean;
  /** Edit mode: the immutable code — shown disabled and never sent (ProcedureUpdate has no code). */
  editCode?: string | null;
  onSubmit: (values: ProcedureFormValues) => void;
  submitting?: boolean;
  serverErrors?: Record<string, string>;
  serverMessage?: string | null;
}

/**
 * ProcedureFormDialog — S-08 procedure create/edit drawer ([MAP §6.6/§6.7]).
 *
 * 480px drawer. In edit mode the `code` input is DISABLED — the backend
 * `ProcedureUpdate` schema has no `code` field (immutable, sending it 422s)
 * — so the form never includes it in the payload. The active toggle is NOT
 * part of the form: activation/deactivation are separate PATCH endpoints
 * ([MAP §6.7]).
 */
export const ProcedureFormDialog: FC<ProcedureFormDialogProps> = ({
  open,
  onClose,
  mode,
  loading = false,
  editCode = null,
  onSubmit,
  submitting = false,
  serverErrors = {},
  serverMessage = null,
}) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProcedureFormValues>({
    resolver: zodResolver(procedureFormSchema),
    mode: 'onTouched',
    // The container remounts via `key` per entity, so editCode is present at
    // mount. In edit mode `code` is disabled but still validated (present in
    // the form state) and simply excluded from the update payload.
    defaultValues: {
      ...defaultProcedureFormValues,
      code: mode === 'edit' ? (editCode ?? '') : '',
    },
  });

  const fieldError = (field: keyof ProcedureFormValues) =>
    errors[field]?.message ?? serverErrors[field];

  const title = mode === 'edit' ? 'Edit Procedure' : 'New Procedure';

  return (
    <Drawer open={open} onClose={onClose} position="right" size="md" ariaLabel={title}>
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
          <div className="flex h-full items-center justify-center py-16" role="status" aria-label="Loading procedure">
            <Spinner size="lg" variant="primary" />
          </div>
        ) : (
          <>
            {serverMessage && (
              <div role="alert" className="mb-4 rounded-lg border border-danger/25 bg-danger/10 p-4">
                <p className="text-body-sm text-danger">{serverMessage}</p>
              </div>
            )}
            <ValidationSummary errors={errors} title="Please review the following fields:" />

            <Form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <input
                id="procedure-code"
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-body text-neutral-800 transition-colors duration-150 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 hover:border-neutral-400 disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400"
                placeholder="Procedure code (e.g. PROPHY)"
                maxLength={20}
                disabled={mode === 'edit'}
                aria-invalid={!!fieldError('code')}
                {...register('code')}
              />
              {fieldError('code') && (
                <p id="procedure-code-error" className="mt-1 text-body-sm text-danger">
                  {fieldError('code')}
                </p>
              )}

              <input
                id="procedure-name"
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-body text-neutral-800 transition-colors duration-150 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 hover:border-neutral-400"
                placeholder="Procedure name"
                maxLength={200}
                aria-invalid={!!fieldError('name')}
                {...register('name')}
              />
              {fieldError('name') && (
                <p id="procedure-name-error" className="mt-1 text-body-sm text-danger">
                  {fieldError('name')}
                </p>
              )}

              <input
                id="procedure-cost"
                type="number"
                min={0}
                step="0.01"
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-body text-neutral-800 transition-colors duration-150 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 hover:border-neutral-400"
                placeholder="Default cost"
                aria-invalid={!!fieldError('default_cost')}
                {...register('default_cost')}
              />
              {fieldError('default_cost') && (
                <p id="procedure-cost-error" className="mt-1 text-body-sm text-danger">
                  {fieldError('default_cost')}
                </p>
              )}

              <Select
                label="Category"
                required
                placeholder="Select category"
                options={PROCEDURE_CATEGORIES.map((c) => ({ value: c, label: PROCEDURE_CATEGORY_LABELS[c] }))}
                error={fieldError('category')}
                {...register('category')}
              />

              <textarea
                id="procedure-description"
                rows={4}
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-body text-neutral-800 transition-colors duration-150 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 hover:border-neutral-400"
                placeholder="Description (optional)"
                maxLength={2000}
                aria-invalid={!!fieldError('description')}
                {...register('description')}
              />
              {fieldError('description') && (
                <p id="procedure-description-error" className="mt-1 text-body-sm text-danger">
                  {fieldError('description')}
                </p>
              )}

              <FormActions
                onCancel={onClose}
                submitting={submitting}
                submitText={mode === 'edit' ? 'Save Changes' : 'Create Procedure'}
                className="mt-2"
              />
            </Form>
          </>
        )}
      </Drawer.Body>
    </Drawer>
  );
};
