import type { FC, ReactNode } from 'react';
import { useFieldArray, useWatch, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../../common/Button/Button';
import { IconButton } from '../../common/Button/IconButton';
import { Icon } from '../../common/Icon/Icon';
import { PAYMENT_CURRENCY_CODE } from '../../../constants/billing';
import {
  computeLineNetAmount,
  emptyLineItemFormValue,
  previewGrandTotal,
} from '../../../utils/invoiceFormUtils';
import { formatCurrency } from '../../../utils/formatting';
import type { InvoiceCreateFormValues, InvoiceLineItemFormValues } from '../../../utils/invoiceFormSchema';

interface MobileLineItemsEditorProps {
  control: Control<InvoiceCreateFormValues>;
  register: UseFormRegister<InvoiceCreateFormValues>;
  errors: FieldErrors<InvoiceCreateFormValues>;
}

const inputClass =
  'h-12 w-full rounded-xl border border-neutral-300 bg-white px-4 text-base text-neutral-800 transition-colors duration-150 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20';

const errorInputClass = 'border-danger focus:border-danger focus:ring-danger/20';

/** Uppercase mobile field label (reference mobile form language). */
const FieldLabel: FC<{ children: ReactNode; required?: boolean }> = ({ children, required = false }) => (
  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
    {children}
    {required && <span className="ml-0.5 text-danger">*</span>}
  </p>
);

/**
 * MobileLineItemsEditor — reference mobile line-item card (screen 49).
 *
 * Each line item renders as its own rounded card with an uppercase
 * "LINE ITEM {n}" header, DESCRIPTION / QUANTITY / UNIT PRICE fields and a
 * tinted NET AMOUNT row; a tinted GRAND TOTAL row sits below the cards.
 * The same backend-mirroring form utilities drive the net/grand previews
 * (computeLineNetAmount / previewGrandTotal) — no business logic is
 * duplicated, only the presentation differs from the desktop editor.
 */
export const MobileLineItemsEditor: FC<MobileLineItemsEditorProps> = ({ control, register, errors }) => {
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const items = useWatch<InvoiceCreateFormValues, 'items'>({ control, name: 'items' });

  return (
    <div className="flex flex-col gap-3">
      {errors.items?.root?.message && (
        <p className="text-body-sm text-danger">{errors.items.root.message}</p>
      )}

      {fields.map((field, index) => {
        const row = items?.[index] as InvoiceLineItemFormValues | undefined;
        const itemError = errors.items?.[index];
        const netAmount = row
          ? computeLineNetAmount(row.unit_price, row.quantity, row.discount_value)
          : '0.00';
        const isLast = index === fields.length - 1;

        return (
          <div key={field.id} className="rounded-2xl border border-neutral-200 bg-white p-4">
            {/* Header */}
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Line item {index + 1}
              </p>
              <div className="flex items-center gap-2">
                {fields.length > 1 && (
                  <IconButton
                    icon={<Icon icon={Trash2} size="sm" />}
                    aria-label={`Remove line item ${index + 1}`}
                    variant="ghost"
                    size="sm"
                    className="hover:text-danger focus-visible:ring-danger/30"
                    onClick={() => remove(index)}
                  />
                )}
                {isLast && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => append(emptyLineItemFormValue())}
                    leftIcon={<Icon icon={Plus} size="xs" />}
                  >
                    Add
                  </Button>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="mt-3">
              <FieldLabel required>Description</FieldLabel>
              <input
                {...register(`items.${index}.description`)}
                type="text"
                placeholder="Composite restoration — 26"
                aria-label={`Line item ${index + 1} description`}
                aria-invalid={!!itemError?.description}
                className={`${inputClass} ${itemError?.description ? errorInputClass : ''}`}
              />
              {itemError?.description?.message && (
                <p className="mt-1 text-body-sm text-danger">{itemError.description.message}</p>
              )}
            </div>

            {/* Quantity + Unit price */}
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <FieldLabel required>Quantity</FieldLabel>
                <input
                  {...register(`items.${index}.quantity`)}
                  type="number"
                  min={1}
                  inputMode="numeric"
                  aria-label={`Line item ${index + 1} quantity`}
                  aria-invalid={!!itemError?.quantity}
                  className={`${inputClass} ${itemError?.quantity ? errorInputClass : ''}`}
                />
                {itemError?.quantity?.message && (
                  <p className="mt-1 text-body-sm text-danger">{itemError.quantity.message}</p>
                )}
              </div>
              <div>
                <FieldLabel required>Unit price</FieldLabel>
                <input
                  {...register(`items.${index}.unit_price`)}
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  aria-label={`Line item ${index + 1} unit price`}
                  aria-invalid={!!itemError?.unit_price}
                  className={`${inputClass} ${itemError?.unit_price ? errorInputClass : ''}`}
                />
                {itemError?.unit_price?.message && (
                  <p className="mt-1 text-body-sm text-danger">{itemError.unit_price.message}</p>
                )}
              </div>
            </div>

            {/* Net amount row */}
            <div className="mt-3 flex items-center justify-between rounded-xl bg-primary-50/70 px-4 py-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
                Net amount
              </span>
              <span className="text-lg font-bold tracking-tight text-neutral-900 tabular-nums">
                {formatCurrency(netAmount, PAYMENT_CURRENCY_CODE)}
              </span>
            </div>
          </div>
        );
      })}

      {/* Grand total row */}
      <div className="flex items-center justify-between rounded-2xl border border-primary-100 bg-primary-50/80 px-4 py-4">
        <span className="text-sm font-semibold uppercase tracking-wide text-neutral-700">
          Grand total
        </span>
        <span className="text-2xl font-bold tracking-tight text-neutral-900 tabular-nums">
          {formatCurrency(previewGrandTotal(items ?? []), PAYMENT_CURRENCY_CODE)}
        </span>
      </div>
    </div>
  );
};
