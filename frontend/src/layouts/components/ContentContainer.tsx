import type { FC, ReactNode } from 'react';
import { PageContainer } from '../../components/common/PageContainer/PageContainer';
import type { PageContainerWidth } from '../../components/common/PageContainer/PageContainer';

export type ContentWidth = PageContainerWidth;

interface ContentContainerProps {
  /** Width constraint mode */
  width?: ContentWidth;
  /** Page content */
  children?: ReactNode;
  /** Additional classes */
  className?: string;
}

/**
 * ContentContainer — max-width constrained content wrapper.
 *
 * Thin wrapper around PageContainer for use inside Workspace.
 * Provides responsive horizontal padding, centered alignment,
 * and consistent max-width constraints for page content.
 *
 * @example
 * ```tsx
 * <Workspace>
 *   <ContentContainer width="wide">
 *     <PageWrapper>
 *       <Outlet />
 *     </PageWrapper>
 *   </ContentContainer>
 * </Workspace>
 * ```
 */
export const ContentContainer: FC<ContentContainerProps> = ({
  width = 'default',
  children,
  className = '',
}) => {
  return (
    <PageContainer width={width} className={className}>
      {children}
    </PageContainer>
  );
};
