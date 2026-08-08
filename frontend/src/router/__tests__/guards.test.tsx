import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const auth = vi.hoisted(() => ({
  user: null as { role: 'USER' | 'ADMIN' } | null,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
}));

vi.mock('../../features/auth/auth-context', () => ({ useAuth: () => auth }));

import { RequireAdmin, RequireAuth, RequireGuest } from '../guards';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<div>login-page</div>} />
      <Route path="/admin" element={<div>admin-login-page</div>} />
      <Route path="/dashboard" element={<div>user-dashboard</div>} />
      <Route path="/admin/dashboard" element={<div>admin-dashboard</div>} />
      <Route
        path="/protected"
        element={<RequireAuth>{content('protected-content')}</RequireAuth>}
      />
      <Route
        path="/admin-protected"
        element={<RequireAdmin>{content('admin-content')}</RequireAdmin>}
      />
      <Route path="/guest" element={<RequireGuest>{content('guest-content')}</RequireGuest>} />
    </Routes>
  );
}

function content(label: string): ReactNode {
  return <div>{label}</div>;
}

function renderAt(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <App />
    </MemoryRouter>
  );
}

beforeEach(() => {
  auth.user = null;
  auth.isLoading = false;
});

describe('RequireAuth', () => {
  it('renders children for an authenticated user', () => {
    auth.user = { role: 'USER' };
    renderAt('/protected');
    expect(screen.getByText('protected-content')).toBeInTheDocument();
  });

  it('redirects to /login when unauthenticated', () => {
    renderAt('/protected');
    expect(screen.getByText('login-page')).toBeInTheDocument();
    expect(screen.queryByText('protected-content')).not.toBeInTheDocument();
  });

  it('shows the loader (no redirect) while the session is loading', () => {
    auth.isLoading = true;
    renderAt('/protected');
    expect(screen.queryByText('protected-content')).not.toBeInTheDocument();
    expect(screen.queryByText('login-page')).not.toBeInTheDocument();
  });
});

describe('RequireAdmin', () => {
  it('renders children for an ADMIN', () => {
    auth.user = { role: 'ADMIN' };
    renderAt('/admin-protected');
    expect(screen.getByText('admin-content')).toBeInTheDocument();
  });

  it('redirects to /admin when unauthenticated', () => {
    renderAt('/admin-protected');
    expect(screen.getByText('admin-login-page')).toBeInTheDocument();
  });

  it('redirects a USER to /dashboard', () => {
    auth.user = { role: 'USER' };
    renderAt('/admin-protected');
    expect(screen.getByText('user-dashboard')).toBeInTheDocument();
    expect(screen.queryByText('admin-content')).not.toBeInTheDocument();
  });
});

describe('RequireGuest', () => {
  it('renders children when unauthenticated', () => {
    renderAt('/guest');
    expect(screen.getByText('guest-content')).toBeInTheDocument();
  });

  it('redirects an authenticated USER to /dashboard', () => {
    auth.user = { role: 'USER' };
    renderAt('/guest');
    expect(screen.getByText('user-dashboard')).toBeInTheDocument();
  });

  it('redirects an authenticated ADMIN to /admin/dashboard', () => {
    auth.user = { role: 'ADMIN' };
    renderAt('/guest');
    expect(screen.getByText('admin-dashboard')).toBeInTheDocument();
  });
});
