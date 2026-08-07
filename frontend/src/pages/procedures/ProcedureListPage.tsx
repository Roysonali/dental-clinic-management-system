import type { FC } from 'react';
import { PageHeader } from '../../components/common/PageHeader/PageHeader';
import { PageWrapper } from '../../layouts/components/PageWrapper';
import { ContentContainer } from '../../layouts/components/ContentContainer';
import { ProcedureListContainer } from '../../components/procedures/containers/ProcedureListContainer';

/**
 * ProcedureListPage — /procedures route page (S-07).
 *
 * Thin composition layer. The route itself is NOT role-gated (reads are 🅰);
 * admin write actions are gated inline via PermissionGate in the container
 * and table ([MAP §3.7]).
 */
export const ProcedureListPage: FC = () => {
  return (
    <ContentContainer width="wide">
      <PageWrapper>
        <PageHeader
          title="Procedure Catalog"
          subtitle="Browse and manage the clinic's treatment procedure catalog."
        />
        <ProcedureListContainer />
      </PageWrapper>
    </ContentContainer>
  );
};
