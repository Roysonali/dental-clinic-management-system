import { Suspense, type FC } from 'react';
import { Outlet } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { Spinner } from '../components/common/Spinner/Spinner';

/**
 * Lazy-load fallback shown while child route components are loading.
 */
const LayoutFallback: FC = () => (
  <div className="flex h-full w-full items-center justify-center">
    <Spinner size="lg" variant="primary" />
  </div>
);

/**
 * DashboardLayout — main authenticated layout.
 *
 * Wraps all protected routes with the Application Shell.
 * Uses React Router Outlet to render matched child routes
 * inside the Workspace area.
 *
 * Actual layout hierarchy:
 * ```
 * DashboardLayout
 * └── AppShell
 *     ├── SidebarPlaceholder
 *     ├── HeaderPlaceholder
 *     └── Workspace
 *         └── <Outlet />
 * ```
 *
 * Recommended page composition (within each route's page component):
 * ```
 * <ContentContainer width="wide">
 *   <PageWrapper>
 *     <PageHeader title="..." />
 *     <Stack spacing="6">
 *       ...
 *     </Stack>
 *   </PageWrapper>
 * </ContentContainer>
 * ```
 *
 * @example
 * ```tsx
 * <Route element={<DashboardLayout />}>
 *   <Route path="/" element={<DashboardPage />} />
 *   <Route path="/patients" element={<PatientListPage />} />
 * </Route>
 * ```
 */
export const DashboardLayout: FC = () => {
  return (
    <AppShell>
      <Suspense fallback={<LayoutFallback />}>
        <Outlet />
      </Suspense>
    </AppShell>
  );
};
