import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateInvoice } from './useInvoiceMutations';
import { invoiceFormValuesToCreatePayload } from '../../utils/invoiceFormUtils';
import { parseApiError } from '../../services/apiError';
import { ROUTES } from '../../routes/routes';
import type { InvoiceCreateFormValues } from '../../utils/invoiceFormSchema';
import type { InvoiceRead } from '../../types/billing';
import type { Toast } from '../../components/common/Toast';

/** Toast lifetime before auto-dismiss (ms) — matches the list container. */
const TOAST_DURATION_MS = 5000;

/**
 * useInvoiceCreateFlow — shared create-draft-invoice workflow.
 *
 * Single source of truth for the create path used by BOTH the Invoice List
 * container (toolbar / mobile-header CTA) and the Billing Dashboard's
 * \"New invoice\" quick action. Both surfaces must produce the identical
 * mutation, error mapping (server field errors vs banner message), success
 * toast and post-save navigation to the new invoice's detail page — so the
 * flow lives here, not duplicated per surface.
 *
 * Consumers keep control of their own open/close state via `onSuccess`
 * (e.g. close the drawer / strip a URL create intent) before the toast and
 * navigation fire.
 */
export function useInvoiceCreateFlow() {
  const navigate = useNavigate();
  const createMutation = useCreateInvoice();
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  // Auto-dismiss the transient success toast.
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  /** Clear server errors when the form (re)opens. */
  const resetErrors = () => {
    setServerErrors({});
    setServerMessage(null);
  };

  /**
   * Submit the create form. On success the consumer's `onSuccess` runs first
   * (close drawer / strip intent), then the toast is shown and the app
   * navigates to the new invoice's detail page.
   */
  const submit = (
    values: InvoiceCreateFormValues,
    options?: { onSuccess?: (invoice: InvoiceRead) => void },
  ) => {
    setServerErrors({});
    setServerMessage(null);
    createMutation.mutate(invoiceFormValuesToCreatePayload(values), {
      onSuccess: (invoice) => {
        options?.onSuccess?.(invoice);
        setToast({
          id: `inv-${Date.now()}`,
          variant: 'success',
          title: `${invoice.invoice_number} saved as draft`,
        });
        navigate(`${ROUTES.BILLING_INVOICES}/${invoice.id}`);
      },
      onError: (error) => {
        const info = parseApiError(error);
        if (info.kind === 'validation' && Object.keys(info.fieldErrors).length > 0) {
          setServerErrors(info.fieldErrors);
        } else {
          setServerMessage(info.message);
        }
      },
    });
  };

  return {
    submit,
    submitting: createMutation.isPending,
    serverErrors,
    serverMessage,
    toast,
    dismissToast: () => setToast(null),
    resetErrors,
  };
}
