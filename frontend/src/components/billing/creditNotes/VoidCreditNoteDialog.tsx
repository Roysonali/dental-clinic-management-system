import { useEffect, type FC } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CircleSlash } from 'lucide-react';
import { Modal } from '../../common/Modal/Modal';
import { Button } from '../../common/Button/Button';
import { Icon } from '../../common/Icon/Icon';
import { Alert } from '../../common/Alert/Alert';
import {
  creditNoteVoidFormSchema,
  type CreditNoteVoidFormValues,
} from '../../../utils/creditNoteFormSchema';
import { CREDIT_NOTE_VOID_REASON_MAX_LENGTH } from '../../../constants/billing';
import type { CreditNoteRead } from '../../../types/billing';

interface VoidCreditNoteDialogProps {
  open: boolean;
  creditNote: CreditNoteRead | null;
  submitting?: boolean;
  error?: string | null;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

export const VoidCreditNoteDialog: FC<VoidCreditNoteDialogProps> = ({
  open,
  creditNote,
  submitting = false,
  error = null,
  onConfirm,
  onClose,
}) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = useForm<CreditNoteVoidFormValues>({
    resolver: zodResolver(creditNoteVoidFormSchema),
    mode: 'onChange',
    defaultValues: { void_reason: '' },
  });

  useEffect(() => {
    if (open) reset({ void_reason: '' });
  }, [open, reset]);

  const handleConfirm = (values: CreditNoteVoidFormValues) => {
    onConfirm(values.void_reason);
  };

  return (
    <Modal open={open} onClose={onClose} size="sm" ariaLabel="Void credit note">
      <Modal.Body className="pt-6">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-danger/10">
            <Icon icon={CircleSlash} size="lg" className="text-danger" />
          </div>
          <h2 className="text-h3 font-semibold text-neutral-900">Void this credit note?</h2>
          <p className="mt-2 text-body text-neutral-500">
            {creditNote?.credit_note_number ?? 'This credit note'} will be voided and its remaining balance can no longer be applied.
          </p>

          <div className="mt-5 w-full">
            <label htmlFor="void_reason" className="mb-1.5 block text-caption font-medium uppercase tracking-wide text-neutral-500">
              Reason <span className="text-danger">*</span>
            </label>
            <textarea
              id="void_reason"
              rows={3}
              placeholder="Why is this credit note being voided?"
              maxLength={CREDIT_NOTE_VOID_REASON_MAX_LENGTH}
              {...register('void_reason')}
              aria-invalid={!!errors.void_reason}
              aria-describedby={errors.void_reason ? 'void_reason-error' : undefined}
              className={`
                w-full rounded-lg border bg-white px-3 py-2.5 text-body text-neutral-800
                placeholder:text-neutral-400
                transition-colors duration-150
                focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500
                resize-y min-h-[80px]
                ${errors.void_reason ? 'border-danger focus:ring-danger/20 focus:border-danger' : 'border-neutral-300 hover:border-neutral-400'}
              `}
            />
            {errors.void_reason && (
              <p id="void_reason-error" className="mt-1 text-body-sm text-danger">{errors.void_reason.message}</p>
            )}
            <p className="mt-1 text-caption text-neutral-400">
              Confirm is enabled once a reason is entered.
            </p>
          </div>

          {error && (
            <Alert variant="danger" className="mt-4 w-full text-left" title="Could not void credit note" description={error} />
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="danger"
          onClick={handleSubmit(handleConfirm)}
          loading={submitting}
          disabled={submitting || !isValid}
        >
          Void credit note
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
