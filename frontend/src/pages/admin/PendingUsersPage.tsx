import type { FC } from 'react';
import { PageHeader } from '../../components/common/PageHeader/PageHeader';
import { PageWrapper } from '../../layouts/components/PageWrapper';
import { ContentContainer } from '../../layouts/components/ContentContainer';
import { PendingUsersContainer } from '../../components/admin/containers/PendingUsersContainer';

/**
 * PendingUsersPage — /admin/users/pending.
 *
 * Admin screen for the registration lifecycle: lists users awaiting
 * approval (GET /auth/users/pending), lets an admin assign a role and
 * approve, or deactivate. The backend enforces the admin-only restriction
 * (403 for other roles), which the container surfaces as an
 * "insufficient permissions" state.
 */
export const PendingUsersPage: FC = () => {
  return (
    <ContentContainer width="wide">
      <PageWrapper>
        <PageHeader
          title="Pending Approvals"
          subtitle="Review and approve registration requests."
        />
        <PendingUsersContainer />
      </PageWrapper>
    </ContentContainer>
  );
};
