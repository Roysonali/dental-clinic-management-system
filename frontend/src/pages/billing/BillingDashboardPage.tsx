import { useState, type FC } from 'react';
import { ContentContainer } from '../../layouts/components/ContentContainer';
import { PageWrapper } from '../../layouts/components/PageWrapper';
import { BillingDashboardHeader } from '../../components/billing/BillingDashboardHeader';
import { BillingDashboardContainer } from '../../components/billing/containers/BillingDashboardContainer';
import { CreateInvoiceDrawer } from '../../components/billing/invoices/dialogs/CreateInvoiceDrawer';
import { MobileCreateInvoiceForm } from '../../components/billing/mobile/MobileCreateInvoiceForm';
import { ToastContainer } from '../../components/common/Toast';
import { MobileBottomNav } from '../../layouts/components/mobile/MobileBottomNav';
import { useIsMobileViewport } from '../../hooks/useIsMobileViewport';
import { useInvoiceCreateFlow } from '../../hooks/billing/useInvoiceCreateFlow';
import type { InvoiceCreateFormValues } from '../../utils/invoiceFormSchema';

/**
 * BillingDashboardPage — /billing route page (Phase 1: Billing Dashboard).
 *
 * Thin composition layer: page header + the dashboard container. All
 * orchestration (dashboard query, patient filter, state branching) lives in
 * BillingDashboardContainer.
 *
 * The "New invoice" quick action (header + empty state) opens the create
 * form DIRECTLY on the dashboard — the user is never routed through the
 * Invoice List page. The create flow (mutation, error mapping, toast,
 * post-save navigation to the new invoice's detail page) is the shared
 * `useInvoiceCreateFlow` hook, the same one the Invoice List page uses.
 */
export const BillingDashboardPage: FC = () => {
  const isMobile = useIsMobileViewport();
  const [createOpen, setCreateOpen] = useState(false);
  const createFlow = useInvoiceCreateFlow();

  const closeCreate = () => {
    setCreateOpen(false);
    createFlow.resetErrors();
  };

  const createProps = {
    open: createOpen,
    onClose: closeCreate,
    onSubmit: (values: InvoiceCreateFormValues) =>
      createFlow.submit(values, { onSuccess: () => setCreateOpen(false) }),
    submitting: createFlow.submitting,
    serverErrors: createFlow.serverErrors,
    serverMessage: createFlow.serverMessage,
  };

  return (
    <ContentContainer width="wide">
      <PageWrapper>
        <BillingDashboardHeader onNewInvoice={() => setCreateOpen(true)} />
        <BillingDashboardContainer onRequestCreate={() => setCreateOpen(true)} />

        {isMobile ? <MobileCreateInvoiceForm {...createProps} /> : <CreateInvoiceDrawer {...createProps} />}
        {createFlow.toast && (
          <ToastContainer
            toasts={[createFlow.toast]}
            position="top-right"
            onDismiss={createFlow.dismissToast}
          />
        )}
      </PageWrapper>

      {/* Consistent mobile bottom navigation (phone breakpoint only) */}
      {isMobile && <MobileBottomNav />}
    </ContentContainer>
  );
};
