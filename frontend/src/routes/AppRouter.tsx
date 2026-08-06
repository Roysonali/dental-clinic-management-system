import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/RegisterPage';
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { DashboardPage } from '../pages/dashboard/DashboardPage';
import { PatientListPage } from '../pages/patients/PatientListPage';
import { PatientDetailsPage } from '../pages/patients/PatientDetailsPage';
import { DoctorListPage } from '../pages/doctors/DoctorListPage';
import { DoctorDetailsPage } from '../pages/doctors/DoctorDetailsPage';
import { UserListPage } from '../pages/users/UserListPage';
import { UserDetailsPage } from '../pages/users/UserDetailsPage';
import { AppointmentListPage } from '../pages/appointments/AppointmentListPage';
import { AppointmentDetailsPage } from '../pages/appointments/AppointmentDetailsPage';
import { PendingUsersPage } from '../pages/admin/PendingUsersPage';
import { ProtectedRoute } from './ProtectedRoute';
import { PublicOnlyRoute } from './PublicOnlyRoute';
import { ROUTES } from './routes';

/**
 * AppRouter — central routing component for the application.
 *
 * All route definitions live here.
 *
 * Route structure:
 * - Auth routes (public): wrapped by PublicOnlyRoute — an already
 *   authenticated user is redirected to the dashboard.
 * - Protected routes (authenticated): wrapped by ProtectedRoute +
 *   DashboardLayout — signed-out users are redirected to /auth/login
 *   (with their intended destination preserved for post-login redirect).
 * - Catch-all: redirects to login.
 *
 * As new modules are added (Patients, Appointments, Billing, etc.),
 * add their routes as children of the DashboardLayout route.
 */
const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* ── Auth Routes (public-only) ─────────────────────── */}
        <Route
          path={ROUTES.AUTH.LOGIN}
          element={
            <PublicOnlyRoute>
              <LoginPage />
            </PublicOnlyRoute>
          }
        />
        <Route
          path={ROUTES.AUTH.REGISTER}
          element={
            <PublicOnlyRoute>
              <RegisterPage />
            </PublicOnlyRoute>
          }
        />
        <Route
          path={ROUTES.AUTH.FORGOT_PASSWORD}
          element={
            <PublicOnlyRoute>
              <ForgotPasswordPage />
            </PublicOnlyRoute>
          }
        />

        {/* ── Protected Routes (authenticated) ────────────── */}
        <Route element={<ProtectedRoute />}>
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

            {/* ── Doctors Module ──────────────────────────── */}
            <Route
              path={ROUTES.DOCTORS}
              element={<DoctorListPage />}
            />
            <Route
              path={`${ROUTES.DOCTORS}/:doctorId`}
              element={<DoctorDetailsPage />}
            />

            {/* ── Users Module ──────────────────────────────── */}
            <Route
              path={ROUTES.USERS}
              element={<UserListPage />}
            />
            {/* Placeholder until Phase 1C replaces it with the real details page. */}
            <Route
              path={`${ROUTES.USERS}/:userId`}
              element={<UserDetailsPage />}
            />

            {/* ── Appointments Module ─────────────────────── */}
            <Route
              path={ROUTES.APPOINTMENTS}
              element={<AppointmentListPage />}
            />
            <Route
              path={`${ROUTES.APPOINTMENTS}/:appointmentId`}
              element={<AppointmentDetailsPage />}
            />

            {/* ── Admin: pending registration approvals ─────── */}
            <Route
              path={ROUTES.ADMIN.PENDING_USERS}
              element={<PendingUsersPage />}
            />
          </Route>
        </Route>

        {/* ── Catch-all: Redirect to login ─────────────── */}
        <Route path="*" element={<Navigate to={ROUTES.AUTH.LOGIN} replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRouter;
