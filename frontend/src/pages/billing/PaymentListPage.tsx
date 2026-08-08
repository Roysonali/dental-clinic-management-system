import { useState, type FC } from 'react';
import { Plus } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader/PageHeader';
import { Button } from '../../components/common/Button/Button';
import { Icon } from '../../components/common/Icon/Icon';
import { PageWrapper } from '../../layouts/components/PageWrapper';
import { ContentContainer } from '../../layouts/components/ContentContainer';
import { PaymentListContainer } from '../../components/billing/payments/containers/PaymentListContainer';

/**
 * PaymentListPage — /billing/payments route page (Sprint 14A.3).
 *
 * Thin composition layer: page-level PageHeader (title + "Record payment"
 * primary action at the upper-right, per the reference spec §7) + the list
 * container. The header CTA and the container's create drawer share the
 * create-open state, which lives here (the page is the common parent). All
 * orchestration (queries, filters, dialogs, pagination) lives in
 * PaymentListContainer. The global header already renders the notification
 * bell, so it is not duplicated here.
 */
export const PaymentListPage: FC = () => {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <ContentContainer width="wide">
      <PageWrapper>
        <PageHeader
          title="Payments"
          subtitle="Billing"
          actions={
            <Button
              variant="primary"
              onClick={() => setCreateOpen(true)}
              leftIcon={<Icon icon={Plus} size="sm" />}
            >
              Record payment
            </Button>
          }
        />
        <PaymentListContainer
          createOpen={createOpen}
          onCreateClose={() => setCreateOpen(false)}
          onRequestCreate={() => setCreateOpen(true)}
        />
      </PageWrapper>
    </ContentContainer>
  );
};
