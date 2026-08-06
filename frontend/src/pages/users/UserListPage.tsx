import type { FC } from 'react';
import { PageHeader } from '../../components/common/PageHeader/PageHeader';
import { PageWrapper } from '../../layouts/components/PageWrapper';
import { ContentContainer } from '../../layouts/components/ContentContainer';
import { UserListContainer } from '../../components/users/containers/UserListContainer';

/**
 * UserListPage — /users route page.
 *
 * Thin composition layer: page-level header + the list container. All
 * orchestration (querying, search/filter/pagination, status + role
 * dialogs) lives in UserListContainer.
 */
export const UserListPage: FC = () => {
  return (
    <ContentContainer width="wide">
      <PageWrapper>
        <PageHeader
          title="Users"
          subtitle="Search, filter and manage user accounts."
        />
        <UserListContainer />
      </PageWrapper>
    </ContentContainer>
  );
};
