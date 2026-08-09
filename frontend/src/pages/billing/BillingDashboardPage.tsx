import type { FC } from 'react';
import { ContentContainer } from '../../layouts/components/ContentContainer';
import { PageWrapper } from '../../layouts/components/PageWrapper';
import { BillingDashboardHeader } from '../../components/billing/BillingDashboardHeader';
import { BillingDashboardContainer } from '../../components/billing/containers/BillingDashboardContainer';
import { MobileBottomNav } from '../../layouts/components/mobile/MobileBottomNav';
import { useIsMobileViewport } from '../../hooks/useIsMobileViewport';

/**
 * BillingDashboardPage — /billing route page (Phase 1: Billing Dashboard).
 *
 * Thin composition layer: page header + the dashboard container. All
 * orchestration (dashboard query, patient filter, state branching) lives in
 * BillingDashboardContainer.
 */
export const BillingDashboardPage: FC = () => {
  const isMobile = useIsMobileViewport();
  return (
    <ContentContainer width="wide">
      <PageWrapper>
        <BillingDashboardHeader />
        <BillingDashboardContainer />
      </PageWrapper>

      {/* Consistent mobile bottom navigation (phone breakpoint only) */}
      {isMobile && <MobileBottomNav />}
    </ContentContainer>
  );
};
