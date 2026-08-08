import type { FC } from 'react';
import { PageHeader } from '../../components/common/PageHeader/PageHeader';
import { PageWrapper } from '../../layouts/components/PageWrapper';
import { ContentContainer } from '../../layouts/components/ContentContainer';
import { InvoiceListContainer } from '../../components/billing/invoices/containers/InvoiceListContainer';

/**
 * InvoiceListPage — /billing/invoices route page (Sprint 14A.2).
 *
 * Thin composition layer: page-level PageHeader + the list container. All
 * orchestration (queries, filters, dialogs, pagination) lives in
 * InvoiceListContainer. The "New invoice" CTA lives in the toolbar next to
 * the search field (same convention as Treatment Plans / Appointments) — the
 * global header already renders the notification bell, so it is not
 * duplicated here.
 */
export const InvoiceListPage: FC = () => {
  return (
    <ContentContainer width="wide">
      <PageWrapper>
        <PageHeader
          title="Invoices"
          subtitle="Billing"
        />
        <InvoiceListContainer />
      </PageWrapper>
    </ContentContainer>
  );
};
