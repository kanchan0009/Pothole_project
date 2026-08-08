import { createBrowserRouter } from 'react-router-dom';
import { PublicLayout } from '../components/layout/PublicLayout';
import { Landing } from '../pages/Landing';
import { PublicMap } from '../pages/PublicMap';
import { About } from '../pages/About';
import { Contact } from '../pages/Contact';
import { NotFound } from '../pages/NotFound';
import { Login } from '../pages/auth/Login';
import { Register } from '../pages/auth/Register';
import { ForgotPassword } from '../pages/auth/ForgotPassword';
import { ResetPassword } from '../pages/auth/ResetPassword';
import { AdminLogin } from '../pages/auth/AdminLogin';
import { UserDashboard } from '../pages/UserDashboard';
import { Profile } from '../pages/Profile';
import { AdminLayout } from '../components/layout/AdminLayout';
import { AdminOverview } from '../pages/admin/AdminOverview';
import { AdminReports } from '../pages/admin/AdminReports';
import { AdminUsers } from '../pages/admin/AdminUsers';
import { AdminMessages } from '../pages/admin/AdminMessages';
import { NewReport } from '../pages/report/NewReport';
import { RequireAdmin, RequireAuth, RequireGuest } from './guards';

/**
 * Application routes.
 */
export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <Landing /> },
      { path: '/map', element: <PublicMap /> },
      { path: '/about', element: <About /> },
      { path: '/contact', element: <Contact /> },
      {
        path: '/login',
        element: (
          <RequireGuest>
            <Login />
          </RequireGuest>
        ),
      },
      {
        path: '/register',
        element: (
          <RequireGuest>
            <Register />
          </RequireGuest>
        ),
      },
      { path: '/forgot-password', element: <ForgotPassword /> },
      { path: '/reset-password', element: <ResetPassword /> },
      {
        path: '/report',
        element: (
          <RequireAuth>
            <NewReport />
          </RequireAuth>
        ),
      },
      {
        path: '/dashboard',
        element: (
          <RequireAuth>
            <UserDashboard />
          </RequireAuth>
        ),
      },
      {
        path: '/profile',
        element: (
          <RequireAuth>
            <Profile />
          </RequireAuth>
        ),
      },
    ],
  },
  {
    path: '/admin',
    element: <AdminLogin />,
  },
  {
    path: '/admin/dashboard',
    element: (
      <RequireAdmin>
        <AdminLayout />
      </RequireAdmin>
    ),
    children: [
      { index: true, element: <AdminOverview /> },
      { path: 'reports', element: <AdminReports /> },
      { path: 'users', element: <AdminUsers /> },
      { path: 'messages', element: <AdminMessages /> },
    ],
  },
  { path: '*', element: <NotFound /> },
]);
