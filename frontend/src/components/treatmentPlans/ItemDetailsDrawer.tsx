import { useState, type FC } from 'react';
import { Drawer } from '../common/Drawer/Drawer';
import { Button } from '../common/Button/Button';
import { Alert } from '../common/Alert/Alert';
import { Textarea } from '../common/Input/Textarea';
import { Badge } from '../common/Badge/Badge';
import { TREATMENT_PLAN_CURRENCY_CODE } from '../../constants/treatmentPlan';
import { formatCurrency } from '../../utils/formatting';
import { formatToothLabel } from '../../utils/treatmentPlanFormatting';
import type { TreatmentPlanItemResponse } from '../../types/treatmentPlan';

interface ItemDetailsDrawerProps {
  open: boolean;
  item: TreatmentPlanItemResponse | null;
  /** Editable-status gate for the notes editor (backend 409 otherwise). */
  canEditNotes: boolean;
  onClose: () => void;
  onSaveNotes: (notes: string) => void;
  submitting?: boolean;
  error?: string | null;
}

/**
 * ItemDetailsDrawer — S-09 scope-cut item drawer ([MAP §3.9]).
 *
 * Read-only summary + a single `notes` editor (PATCH item). There are
 * deliberately NO item-status action buttons — no item-transition endpoint
 * exists (O2/U2). Notes are never cleared: `""` is invalid to the backend
 * and `null` is ignored (R14, U16 in the mapping doc).
 */
export const ItemDetailsDrawer: FC<ItemDetailsDrawerProps> = ({
  open,
  item,
  canEditNotes,
  onClose,
  onSaveNotes,
  submitting = false,
  error = null,
}) => {
  // The container remounts this drawer per row via `key`, so the notes draft
  // is initialised directly from the opened item — no effect-sync needed.
  const [notes, setNotes] = useState<string>(item?.notes ?? '');

  if (!item) return null;

  return (
    <Drawer open={open} onClose={onClose} size="lg" ariaLabel="Item details">
      <Drawer.Header>
        <div>
          <h2 className="text-h4 font-semibold text-neutral-900">Item Details</h2>
          <p className="mt-0.5 text-body-sm text-neutral-500">
            {item.procedure ? `${item.procedure.name} (${item.procedure.code})` : `Procedure #${item.procedure_id}`}
          </p>
        </div>
      </Drawer.Header>

      <Drawer.Body>
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-caption font-medium uppercase tracking-wide text-neutral-500">Sequence</dt>
            <dd className="mt-0.5 text-body font-medium text-neutral-900">{item.sequence_number}</dd>
          </div>
          <div>
            <dt className="text-caption font-medium uppercase tracking-wide text-neutral-500">Status</dt>
            <dd className="mt-0.5">
              <Badge variant="neutral" size="sm">Pending</Badge>
            </dd>
          </div>
          <div>
            <dt className="text-caption font-medium uppercase tracking-wide text-neutral-500">Tooth</dt>
            <dd className="mt-0.5 text-body text-neutral-900">{formatToothLabel(item.tooth_number, item.tooth_surface)}</dd>
          </div>
          <div>
            <dt className="text-caption font-medium uppercase tracking-wide text-neutral-500">Position</dt>
            <dd className="mt-0.5 text-body text-neutral-900">
              {[item.quadrant, item.arch].filter(Boolean).join(' · ') || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-caption font-medium uppercase tracking-wide text-neutral-500">Estimated Cost</dt>
            <dd className="mt-0.5 text-body font-medium text-neutral-900 tabular-nums">
              {formatCurrency(item.estimated_cost, TREATMENT_PLAN_CURRENCY_CODE)}
            </dd>
          </div>
          <div>
            <dt className="text-caption font-medium uppercase tracking-wide text-neutral-500">Discount</dt>
            <dd className="mt-0.5 text-body text-neutral-900 tabular-nums">
              {item.discount ? formatCurrency(item.discount, TREATMENT_PLAN_CURRENCY_CODE) : '—'}
            </dd>
          </div>
        </dl>

        <div className="mt-6">
          <Textarea
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={!canEditNotes}
            maxLength={5000}
            placeholder={canEditNotes ? 'Add or update notes…' : 'Notes are read-only in this status.'}
            rows={4}
            helperText={canEditNotes ? undefined : 'Notes can only be edited while the plan is editable.'}
          />
          {error && (
            <Alert variant="danger" className="mt-3" title="Could not save notes" description={error} />
          )}
        </div>
      </Drawer.Body>

      <Drawer.Footer>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        {canEditNotes && (
          <Button variant="primary" loading={submitting} disabled={submitting || notes === (item.notes ?? '')} onClick={() => onSaveNotes(notes)}>
            Save Notes
          </Button>
        )}
      </Drawer.Footer>
    </Drawer>
  );
};
