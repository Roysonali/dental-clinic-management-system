import type { FC, ReactNode } from 'react';

/**
 * Workspace — scrollable content container that holds page content.
 *
 * Renders below the HeaderPlaceholder inside the authenticated layout.
 * Provides safe responsive horizontal padding by default to prevent
 * edge-to-edge rendering. Pages that need tighter width control should
 * wrap their content in <ContentContainer> or <PageContainer>.
 *
 * @example
 * ```tsx
 * <Workspace>
 *   <Outlet />
 * </Workspace>
 * ```
 */
interface WorkspaceProps {
  /** Page content */
  children?: ReactNode;
  /** Additional classes */
  className?: string;
}

export const Workspace: FC<WorkspaceProps> = ({ children, className = '' }) => {
  return (
    <main
      className={`min-h-0 flex-1 overflow-y-auto bg-neutral-50 px-4 sm:px-6 lg:px-8 ${className}`}
      aria-label="Main content"
    >
      {children}
    </main>
  );
};
