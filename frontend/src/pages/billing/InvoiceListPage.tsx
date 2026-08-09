import { useState, type FC } from 'react';
import { PageHeader } from '../../components/common/PageHeader/PageHeader';
import { PageWrapper } from '../../layouts/components/PageWrapper';
import { ContentContainer } from '../../layouts/components/ContentContainer';
import { InvoiceListContainer } from '../../components/billing/invoices/containers/InvoiceListContainer';
import { MobileBillingHeader } from '../../components/billing/mobile/MobileBillingHeader';
import { MobileBottomNav } from '../../components/billing/mobile/MobileBottomNav';
import { useIsMobileViewport } from '../../hooks/useIsMobileViewport';

/**
 * InvoiceListPage — /billing/invoices route page (Sprint 14A.2).
 *
 * Thin composition layer. On the phone breakpoint the page renders the
 * compact mobile header (hamburger + title + icon-only +, reference screen
 * 47) and the fixed bottom navigation, and the global app header is hidden
 * by the AppShell for this route; the container renders the mobile card
 * list. On desktop the original PageHeader + table container render
 * unchanged. The create-form open state lives here (common parent of the
 * mobile header CTA and the container's toolbar/URL-intent), mirroring the
 * PaymentListPage pattern.
 */
export const InvoiceListPage: FC = () => {
  const isMobile = useIsMobileViewport();
  const [createOpen, setCreateOpen] = useState(false);

  if (isMobile) {
    return (
      // Negative horizontal margins cancel the Workspace's px padding so the
      // compact header renders edge-to-edge white (reference screens) while
      // the list content keeps its own 24px padding below it.
      <div className="-mx-4 flex w-full min-w-0 flex-col sm:-mx-6">
        <MobileBillingHeader
          title="Invoices"
          addLabel="New invoice"
          onAdd={() => setCreateOpen(true)}
        />
        <InvoiceListContainer
          createOpen={createOpen}
          onCreateClose={() => setCreateOpen(false)}
          onRequestCreate={() => setCreateOpen(true)}
        />
        <MobileBottomNav />
      </div>
    );
  }

  return (
    <ContentContainer width="wide">
      <PageWrapper>
        <PageHeader
          title="Invoices"
          subtitle="Billing"
        />
        <InvoiceListContainer
          createOpen={createOpen}
          onCreateClose={() => setCreateOpen(false)}
          onRequestCreate={() => setCreateOpen(true)}
        />
      </PageWrapper>
    </ContentContainer>
  );
};
