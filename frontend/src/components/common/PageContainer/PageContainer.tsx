import type { FC, ReactNode } from 'react';

export type PageContainerWidth = 'default' | 'fluid' | 'narrow' | 'wide';

interface PageContainerProps {
  /** Width constraint mode */
  width?: PageContainerWidth;
  /** Page content */
  children?: ReactNode;
  /** Additional classes */
  className?: string;
}

const maxWidths: Record<PageContainerWidth, string> = {
  default: 'max-w-5xl',   // 1024px
  fluid: 'max-w-full',
  narrow: 'max-w-3xl',    // 768px
  wide: 'max-w-7xl',      // 1280px
};

/**
 * PageContainer — consistent page wrapper providing max-width constraints
 * and responsive horizontal padding.
 *
 * Every page in the application should use this as the top-level wrapper.
 *
 * @example
 * ```tsx
 * <PageContainer width="wide">
 *   <PageHeader title="Dashboard" />
 *   <Stack spacing="6">
 *     <StatCard ... />
 *   </Stack>
 * </PageContainer>
 * ```
 */
export const PageContainer: FC<PageContainerProps> = ({
  width = 'default',
  children,
  className = '',
}) => {
  return (
    <div className={`mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 lg:py-8 ${maxWidths[width]} ${className}`}>
      {children}
    </div>
  );
};
