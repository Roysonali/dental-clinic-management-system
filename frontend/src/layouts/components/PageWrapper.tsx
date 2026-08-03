import type { FC, ReactNode } from 'react';
import { Stack } from '../../components/common/Stack/Stack';

interface PageWrapperProps {
  /** Content to wrap */
  children?: ReactNode;
  /** Additional classes */
  className?: string;
}

/**
 * PageWrapper — consistent vertical spacing for page content.
 *
 * Thin wrapper around Stack for semantic clarity in page layout.
 * Provides a uniform gap structure that all feature pages (Dashboard,
 * Patients, Appointments, etc.) will use as their outermost wrapper.
 * Use inside ContentContainer within Workspace.
 *
 * @example
 * ```tsx
 * <PageWrapper>
 *   <PageHeader title="Patients" />
 *   <StatCard ... />
 *   <Table ... />
 * </PageWrapper>
 * ```
 */
export const PageWrapper: FC<PageWrapperProps> = ({ children, className = '' }) => {
  return (
    <Stack spacing={6} className={className}>
      {children}
    </Stack>
  );
};
