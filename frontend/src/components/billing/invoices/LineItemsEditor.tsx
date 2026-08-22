import type { FC } from 'react';
import { useFieldArray, useWatch, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../../common/Button/Button';
import { IconButton } from '../../common/Button/IconButton';
import { Icon } from '../../common/Icon/Icon';
import { Label } from '../../common/Form/Label';
import { INVOICE_DISCOUNT_TYPE_OPTIONS, PAYMENT_CURRENCY_CODE } from '../../../constants/billing';
import { computeLineNetAmount } from '../../../utils/invoiceFormUtils';
import { formatCurrency } from '../../../utils/formatting';
import type { InvoiceCreateFormValues, InvoiceLineItemFormValues } from '../../../utils/invoiceFormSchema';

interface LineItemsEditorProps {
  control: Control<InvoiceCreateFormValues>;
  register: UseFormRegister<InvoiceCreateFormValues>;
  errors: FieldErrors<InvoiceCreateFormValues>;
}

const baseInputClass =
  'w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-body text-neutral-800 transition-colors duration-150 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400';

const errorInputClass = 'border-danger focus:border-danger focus:ring-danger/20';

/**
 * LineItemsEditor — dynamic line-item array for the create-invoice drawer.
 *
 * Mirrors backend `InvoiceItemCreate` fields (description, quantity,
 * unit_price, discount_type, discount_value). The net-amount preview mirrors
 * the backend rule `max(0, unit_price * qty - discount_value)` and is a UX
 * preview only — the backend recomputes and remains authoritative. At least
 * one item is required (backend `MIN_LINE_ITEMS_PER_INVOICE`), so the remove
 * button disables when only one row remains.
 */
export const LineItemsEditor: FC<LineItemsEditorProps> = ({ control, register, errors }) => {
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  // Live values so the per-row net preview tracks keystrokes.
  const items = useWatch<InvoiceCreateFormValues, 'items'>({ control, name: 'items' });

  return (
    <div className="space-y-3">
      <p className="text-label font-semibold text-neutral-700">Line items</p>

      {errors.items?.root?.message && (
        <p className="text-body-sm text-danger">{errors.items.root.message}</p>
      )}

      {fields.map((field, index) => {
        const row = items?.[index] as InvoiceLineItemFormValues | undefined;
        const itemError = errors.items?.[index];
        const netAmount = row
          ? computeLineNetAmount(row.unit_price, row.quantity, row.discount_value)
          : '0.00';

        return (
          <div
            key={field.id}
            className="rounded-lg border border-neutral-200 bg-neutral-50/40 p-3"
          >
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-6">
              {/* Description */}
              <div className="md:col-span-6">
                <Label htmlFor={`items.${index}.description`} required>
                  Description
                </Label>
                <input
                  {...register(`items.${index}.description`)}
                  type="text"
                  id={`items.${index}.description`}
                  placeholder="e.g. Root canal treatment — tooth #36"
                  aria-label={`Item ${index + 1} description`}
                  aria-invalid={!!itemError?.description}
                  className={`${baseInputClass} ${itemError?.description ? errorInputClass : ''}`}
                />
                {itemError?.description?.message && (
                  <p className="mt-1 text-body-sm text-danger">{itemError.description.message}</p>
                )}
              </div>

              {/* Quantity */}
              <div className="md:col-span-1">
                <Label htmlFor={`items.${index}.quantity`} required>
                  Quantity
                </Label>
                <input
                  {...register(`items.${index}.quantity`)}
                  type="number"
                  id={`items.${index}.quantity`}
                  min={1}
                  placeholder="1"
                  aria-label={`Item ${index + 1} quantity`}
                  aria-invalid={!!itemError?.quantity}
                  className={`${baseInputClass} ${itemError?.quantity ? errorInputClass : ''}`}
                />
                {itemError?.quantity?.message && (
                  <p className="mt-1 text-body-sm text-danger">{itemError.quantity.message}</p>
                )}
              </div>

              {/* Unit price */}
              <div className="md:col-span-2">
                <Label htmlFor={`items.${index}.unit_price`} required>
                  Unit price
                </Label>
                <input
                  {...register(`items.${index}.unit_price`)}
                  type="text"
                  id={`items.${index}.unit_price`}
                  inputMode="decimal"
                  placeholder="0.00"
                  aria-label={`Item ${index + 1} unit price`}
                  aria-invalid={!!itemError?.unit_price}
                  className={`${baseInputClass} ${itemError?.unit_price ? errorInputClass : ''}`}
                />
                {itemError?.unit_price?.message && (
                  <p className="mt-1 text-body-sm text-danger">{itemError.unit_price.message}</p>
                )}
              </div>

              {/* Discount type */}
              <div className="md:col-span-1">
                <Label htmlFor={`items.${index}.discount_type`}>Discount</Label>
                <select
                  {...register(`items.${index}.discount_type`)}
                  id={`items.${index}.discount_type`}
                  aria-label={`Item ${index + 1} discount type`}
                  className={baseInputClass}
                >
                  <option value="">None</option>
                  {INVOICE_DISCOUNT_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Discount value */}
              <div className="md:col-span-2">
                <Label htmlFor={`items.${index}.discount_value`}>Discount value</Label>
                <input
                  {...register(`items.${index}.discount_value`)}
                  type="text"
                  id={`items.${index}.discount_value`}
                  inputMode="decimal"
                  placeholder="0.00"
                  aria-label={`Item ${index + 1} discount value`}
                  aria-invalid={!!itemError?.discount_value}
                  disabled={row?.discount_type === ''}
                  className={`${baseInputClass} ${itemError?.discount_value ? errorInputClass : ''}`}
                />
                {itemError?.discount_value?.message && (
                  <p className="mt-1 text-body-sm text-danger">{itemError.discount_value.message}</p>
                )}
              </div>
            </div>

            <div className="mt-2.5 flex items-center justify-between gap-3">
              <p className="text-caption text-neutral-500">
                Net amount:{' '}
                <span className="font-medium text-neutral-800 tabular-nums">
                  {formatCurrency(netAmount, PAYMENT_CURRENCY_CODE)}
                </span>
              </p>
              <IconButton
                icon={<Icon icon={Trash2} size="sm" />}
                aria-label={`Remove item ${index + 1}`}
                variant="ghost"
                size="sm"
                disabled={fields.length <= 1}
                className="hover:text-danger focus-visible:ring-danger/30"
                onClick={() => remove(index)}
              />
            </div>
          </div>
        );
      })}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          append({
            description: '',
            quantity: '1',
            unit_price: '',
            discount_type: '',
            discount_value: '',
          })
        }
        leftIcon={<Icon icon={Plus} size="xs" />}
      >
        Add item
      </Button>
    </div>
  );
};
