import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/RegisterPage';
import { ROUTES } from './routes';

/**
 * AppRouter — central routing component for the application.
 *
 * All route definitions live here. As new modules are added (Dashboard,
 * Patients, Appointments, etc.), add their routes to this component.
 */
const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* ── Auth Routes ──────────────────────────────── */}
        <Route path={ROUTES.AUTH.LOGIN} element={<LoginPage />} />
        <Route path={ROUTES.AUTH.REGISTER} element={<RegisterPage />} />

        {/* ── Catch-all: Redirect to login ─────────────── */}
        <Route path="*" element={<Navigate to={ROUTES.AUTH.LOGIN} replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRouter;
