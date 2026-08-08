import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';
import { Spinner } from '../components/ui/Spinner';
import type { ReactNode } from 'react';

function FullPageLoader() {
  return (
    <div className="grid min-h-screen place-items-center bg-background">
      <Spinner size="lg" />
    </div>
  );
}

/** Requires an authenticated session (any role). */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <FullPageLoader />;
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

/** Requires an ADMIN session — used for /admin routes. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <FullPageLoader />;
  if (!user) {
    return <Navigate to="/admin" replace state={{ from: location.pathname }} />;
  }
  if (user.role !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

/** Blocks authenticated users from guest-only pages (login/register). */
export function RequireGuest({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <FullPageLoader />;
  if (user) {
    return <Navigate to={user.role === 'ADMIN' ? '/admin/dashboard' : '/dashboard'} replace />;
  }
  return <>{children}</>;
}
