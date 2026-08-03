import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/RegisterPage';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { DashboardPage } from '../pages/dashboard/DashboardPage';
import { PatientListPage } from '../pages/patients/PatientListPage';
import { PatientDetailsPage } from '../pages/patients/PatientDetailsPage';
import { ROUTES } from './routes';

/**
 * AppRouter — central routing component for the application.
 *
 * All route definitions live here.
 *
 * Route structure:
 * - Auth routes (public): wrapped by AuthLayout per-page
 * - Protected routes (authenticated): wrapped by DashboardLayout
 * - Catch-all: redirects to login
 *
 * As new modules are added (Patients, Appointments, Billing, etc.),
 * add their routes as children of the DashboardLayout route.
 */
const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* ── Auth Routes (public) ─────────────────────── */}
        <Route path={ROUTES.AUTH.LOGIN} element={<LoginPage />} />
        <Route path={ROUTES.AUTH.REGISTER} element={<RegisterPage />} />

        {/* ── Protected Routes (authenticated) ────────── */}
        <Route element={<DashboardLayout />}>
          {/* Home → Dashboard */}
          <Route
            path={ROUTES.HOME}
            element={<Navigate to={ROUTES.DASHBOARD} replace />}
          />
          <Route
            path={ROUTES.DASHBOARD}
            element={<DashboardPage />}
          />

          {/* ── Patients Module ─────────────────────── */}
          <Route
            path={ROUTES.PATIENTS}
            element={<PatientListPage />}
          />
          <Route
            path={`${ROUTES.PATIENTS}/:patientId`}
            element={<PatientDetailsPage />}
          />
        </Route>

        {/* ── Catch-all: Redirect to login ─────────────── */}
        <Route path="*" element={<Navigate to={ROUTES.AUTH.LOGIN} replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRouter;
