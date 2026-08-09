import { useMutation, useQueryClient } from '@tanstack/react-query';
import { billingService } from '../../services/billingService';
import { billingQueryKeys } from './billingQueryKeys';
import type { CreditNoteCreatePayload, CreditNoteRead, CreditNoteVoidPayload } from '../../types/billing';

/**
 * Credit Note lifecycle mutations (Sprint 14A.4).
 *
 * Every mutation changes credit note / invoice data that the Billing Dashboard
 * and Invoice detail derive from — so the `'billing'` ROOT is invalidated on
 * success (the shared invalidation contract).
 *
 * The detail key is also explicitly set from mutation responses because the
 * backend does not expose GET /billing/credit-notes/{id}. The mutation
 * responses return CreditNoteRead, which is cached here so the Credit Note
 * detail page can render it without a dedicated GET endpoint.
 */

/** POST /billing/credit-notes — create a Draft credit note. */
export function useCreateCreditNote() {
  const queryClient = useQueryClient();
  return useMutation<CreditNoteRead, Error, CreditNoteCreatePayload>({
    mutationFn: (payload) => billingService.createCreditNote(payload),
    onSuccess: (creditNote) => {
      void queryClient.invalidateQueries({ queryKey: billingQueryKeys.all });
      // Cache the created credit note for the detail page (no backend GET).
      void queryClient.setQueryData(
        billingQueryKeys.creditNoteDetail(creditNote.id),
        creditNote,
      );
    },
  });
}

/** POST /billing/credit-notes/{id}/issue — issue a Draft credit note. */
export function useIssueCreditNote() {
  const queryClient = useQueryClient();
  return useMutation<CreditNoteRead, Error, string>({
    mutationFn: (id) => billingService.issueCreditNote(id),
    onSuccess: (creditNote) => {
      void queryClient.invalidateQueries({ queryKey: billingQueryKeys.all });
      void queryClient.setQueryData(
        billingQueryKeys.creditNoteDetail(creditNote.id),
        creditNote,
      );
    },
  });
}

/** POST /billing/credit-notes/{id}/void — void a credit note. */
export function useVoidCreditNote() {
  const queryClient = useQueryClient();
  return useMutation<CreditNoteRead, Error, { id: string; payload: CreditNoteVoidPayload }>({
    mutationFn: ({ id, payload }) => billingService.voidCreditNote(id, payload),
    onSuccess: (creditNote) => {
      void queryClient.invalidateQueries({ queryKey: billingQueryKeys.all });
      void queryClient.setQueryData(
        billingQueryKeys.creditNoteDetail(creditNote.id),
        creditNote,
      );
    },
  });
}

/** POST /billing/credit-notes/{id}/apply — apply an issued credit note. */
export function useApplyCreditNote() {
  const queryClient = useQueryClient();
  return useMutation<CreditNoteRead, Error, string>({
    mutationFn: (id) => billingService.applyCreditNote(id),
    onSuccess: (creditNote) => {
      void queryClient.invalidateQueries({ queryKey: billingQueryKeys.all });
      void queryClient.setQueryData(
        billingQueryKeys.creditNoteDetail(creditNote.id),
        creditNote,
      );
    },
  });
}
