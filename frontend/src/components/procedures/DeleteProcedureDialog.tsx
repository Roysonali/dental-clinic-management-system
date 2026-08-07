import type { FC } from 'react';
import { Modal } from '../common/Modal/Modal';
import { Button } from '../common/Button/Button';
import { Alert } from '../common/Alert/Alert';
import type { ProcedureResponse } from '../../types/procedure';

export type ProcedureStatusIntent = 'activate' | 'deactivate' | 'delete';

interface DeleteProcedureDialogProps {
  open: boolean;
  procedure: ProcedureResponse | null;
  intent: ProcedureStatusIntent | null;
  submitting?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

/** Copy + confirm label per intent. */
const INTENT_COPY: Record<ProcedureStatusIntent, { title: string; body: string; confirm: string; destructive: boolean }> = {
  activate: {
    title: 'Activate Procedure',
    body: 'Activate this procedure? It becomes available in treatment plan item forms.',
    confirm: 'Activate',
    destructive: false,
  },
  deactivate: {
    title: 'Deactivate Procedure',
    body: 'Deactivate this procedure? It will no longer appear in item forms (existing plans are unaffected).',
    confirm: 'Deactivate',
    destructive: true,
  },
  delete: {
    title: 'Delete Procedure',
    body: 'Permanently delete this procedure? Deleting is only allowed while the procedure is INACTIVE (backend rule). This cannot be undone.',
    confirm: 'Delete',
    destructive: true,
  },
};

/**
 * DeleteProcedureDialog — ⭐ (ADMIN/CHIEF_DOCTOR) confirmations for the
 * procedure activate/deactivate/delete endpoints ([MAP §6.7/§6.8]).
 *
 * The trigger is gated by the container's PermissionGate; the delete hint
 * ("deactivate first") is surfaced when the backend 409s on an active
 * procedure ([MAP §11]).
 */
export const DeleteProcedureDialog: FC<DeleteProcedureDialogProps> = ({
  open,
  procedure,
  intent,
  submitting = false,
  error = null,
  onConfirm,
  onClose,
}) => {
  const spec = intent ? INTENT_COPY[intent] : null;
  if (!spec) return null;

  return (
    <Modal open={open} onClose={onClose} size="sm" ariaLabel={spec.title}>
      <Modal.Header>
        <h2 className="text-h4 font-semibold text-neutral-900">{spec.title}</h2>
      </Modal.Header>
      <Modal.Body>
        <p className="text-body text-neutral-600">
          {spec.body} <span className="font-mono font-semibold text-neutral-900">{procedure?.code ?? ''}</span>
        </p>
        {error && <Alert variant="danger" className="mt-3" title="Action failed" description={error} />}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant={spec.destructive ? 'danger' : 'primary'}
          onClick={onConfirm}
          loading={submitting}
          disabled={submitting || !procedure}
        >
          {spec.confirm}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
