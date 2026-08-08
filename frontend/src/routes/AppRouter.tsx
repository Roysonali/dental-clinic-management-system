import { Suspense, lazy, type FC } from 'react';
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
import { RequireRole } from '../components/rbac/RequireRole';
import { Spinner } from '../components/common/Spinner';
import { ROUTES } from './routes';
import { ROUTE_ROLE_REQUIREMENTS } from './routeRequirements';

// Route-level code splitting (F-05): the Treatment Plan + Procedure Catalog
// pages are lazy-loaded into their own chunks so the initial dashboard bundle
// stays lean. Named exports are mapped to default for React.lazy. The shared
// Spinner fallback mirrors the app's loading language.
const TreatmentPlanListPage = lazy(() =>
  import('../pages/treatmentPlans/TreatmentPlanListPage').then((m) => ({ default: m.TreatmentPlanListPage })),
);
const TreatmentPlanDetailsPage = lazy(() =>
  import('../pages/treatmentPlans/TreatmentPlanDetailsPage').then((m) => ({ default: m.TreatmentPlanDetailsPage })),
);
const ProcedureListPage = lazy(() =>
  import('../pages/procedures/ProcedureListPage').then((m) => ({ default: m.ProcedureListPage })),
);
const PatientRecordListPage = lazy(() =>
  import('../pages/patientRecords/PatientRecordListPage').then((m) => ({ default: m.PatientRecordListPage })),
);
const PatientRecordDetailsPage = lazy(() =>
  import('../pages/patientRecords/PatientRecordDetailsPage').then((m) => ({ default: m.PatientRecordDetailsPage })),
);

/** Suspense fallback for lazy routes — centred spinner with an accessible label. */
const RouteFallback: FC = () => (
  <div className="flex min-h-[50vh] w-full items-center justify-center" role="status" aria-live="polite">
    <Spinner size="lg" centered label="Loading" />
  </div>
);

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
      {/*
        Suspense wraps <Routes> (NOT the other way around — react-router
        requires Routes children to be Route/Fragment only). The fallback
        renders only while a lazy route chunk loads; statically imported
        routes never suspend.
      */}
      <Suspense fallback={<RouteFallback />}>
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

            {/* ── Admin-only module group (Sprint 11C RBAC) ── */}
            {/*
              Every /users and /auth/users/pending endpoint is
              require_admin (ADMIN + CHIEF_DOCTOR) on the backend, so the
              Users module and the pending-approvals screen are guarded
              client-side by RequireRole. Non-admins are redirected to the
              dashboard; a transient role-resolution failure fails open
              (the backend still enforces with 403).
            */}
            {/* All three routes share the /users entry in the policy map
                (ADMIN + CHIEF_DOCTOR) — single source of truth. */}
            <Route
              element={
                <RequireRole requiredRoles={ROUTE_ROLE_REQUIREMENTS[ROUTES.USERS]} />
              }
            >
              {/* ── Users Module ──────────────────────────── */}
              <Route
                path={ROUTES.USERS}
                element={<UserListPage />}
              />
              {/* Placeholder until Phase 1C replaces it with the real details page. */}
              <Route
                path={`${ROUTES.USERS}/:userId`}
                element={<UserDetailsPage />}
              />

              {/* ── Admin: pending registration approvals ── */}
              <Route
                path={ROUTES.ADMIN.PENDING_USERS}
                element={<PendingUsersPage />}
              />
            </Route>

            {/* ── Appointments Module ─────────────────────── */}
            <Route
              path={ROUTES.APPOINTMENTS}
              element={<AppointmentListPage />}
            />
            <Route
              path={`${ROUTES.APPOINTMENTS}/:appointmentId`}
              element={<AppointmentDetailsPage />}
            />

            {/* ── Treatment Plan Module ─────────────────────── */}
            {/*
              Plan + procedure READ endpoints allow the full plan role set
              🅰 (6 roles) and DENTAL_ASSISTANT is excluded everywhere — but
              the client cannot resolve non-admin roles, so these routes are
              ProtectedRoute-only (no role gate). Admin procedure WRITES are
              gated inline via PermissionGate (⭐ = ADMIN + CHIEF_DOCTOR).
              Backend remains the ultimate authority ([MAP §9]).
            */}
            <Route
              path={ROUTES.TREATMENT_PLANS}
              element={<TreatmentPlanListPage />}
            />
            <Route
              path={`${ROUTES.TREATMENT_PLANS}/:planId`}
              element={<TreatmentPlanDetailsPage />}
            />
            <Route
              path={ROUTES.PROCEDURES}
              element={<ProcedureListPage />}
            />

            {/* ── Patient Records Module ─────────────────────────── */}
            {/*
              Every patient-records endpoint allows the 6 read roles 🅰
              (DENTAL_ASSISTANT excluded) — the client cannot resolve
              non-admin roles, so the routes are ProtectedRoute-only (no
              role gate) and the backend enforces with 403. Admin-only
              record DELETE is gated inline via PermissionGate on the
              detail page. Lazy-loaded for route-level code splitting.
            */}
            <Route
              path={ROUTES.PATIENT_RECORDS}
              element={<PatientRecordListPage />}
            />
            <Route
              path={`${ROUTES.PATIENT_RECORDS}/:recordId`}
              element={<PatientRecordDetailsPage />}
            />
          </Route>
        </Route>

        {/* ── Catch-all: Redirect to login ─────────────── */}
        <Route path="*" element={<Navigate to={ROUTES.AUTH.LOGIN} replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default AppRouter;
