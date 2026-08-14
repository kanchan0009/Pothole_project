import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FaClipboardList,
  FaEnvelope,
  FaRoad,
  FaSignOutAlt,
  FaTachometerAlt,
  FaTimes,
  FaUsers,
  FaArrowLeft,
} from 'react-icons/fa';
import { useAuth } from '../../features/auth/auth-context';
import { useToast } from '../ui/Toast';
import { NotificationsBell } from '../ui/NotificationsBell';
import { NotificationToastWatcher } from '../ui/NotificationToastWatcher';

const ADMIN_NAV = [
  { to: '/admin/dashboard', label: 'Overview', icon: FaTachometerAlt, end: true },
  { to: '/admin/dashboard/reports', label: 'Reports', icon: FaClipboardList, end: false },
  { to: '/admin/dashboard/users', label: 'Users', icon: FaUsers, end: false },
  { to: '/admin/dashboard/messages', label: 'Messages', icon: FaEnvelope, end: false },
];

const USER_NAV = [
  { to: '/dashboard', label: 'My Dashboard', icon: FaTachometerAlt, end: true },
  { to: '/report', label: 'Report Hazard', icon: FaClipboardList, end: false },
  { to: '/profile', label: 'My Profile', icon: FaUsers, end: false },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  async function handleLogout() {
    await logout();
    toast.info('Logged out');
    navigate('/');
  }

  const isAdmin = user?.role === 'ADMIN';
  const navLinks = isAdmin ? ADMIN_NAV : USER_NAV;

  return (
    <div className="flex h-full flex-col bg-[#0f284e] text-white">
      <div className="flex items-center gap-3 px-5 py-5">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/15 text-accent">
          <FaRoad className="text-lg" />
        </span>
        <div>
          <p className="text-base font-extrabold tracking-tight">RoadGuard</p>
          <p className="text-[11px] font-medium uppercase tracking-wider text-accent/80">
            {isAdmin ? 'Admin Console' : 'Citizen Portal'}
          </p>
        </div>
      </div>

      <nav className="mt-2 flex-1 space-y-1 px-3">
        {navLinks.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-semibold transition-all duration-200 ${
                isActive ? 'bg-accent/15 text-accent' : 'text-white/70 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <Icon className="text-base" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="mb-3 flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/20 text-sm font-bold text-accent">
            {user?.name?.[0]?.toUpperCase() ?? 'A'}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{user?.name}</p>
            <p className="truncate text-[11px] text-white/50">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm font-semibold text-white/80 transition hover:bg-danger/80 hover:text-white"
        >
          <FaSignOutAlt />
          Sign out
        </button>
      </div>
    </div>
  );
}


export function DashboardLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <SidebarContent />
      </aside>

      {}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-primary/40 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} aria-hidden />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="fixed inset-y-0 left-0 z-50 w-64 lg:hidden"
            >
              <SidebarContent onNavigate={() => setMobileOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-white/40 bg-white/70 backdrop-blur-lg">
          <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
                className="grid h-10 w-10 place-items-center rounded-lg bg-white/70 text-primary-light transition hover:bg-white lg:hidden"
              >
                <FaTachometerAlt className="rotate-90" />
              </button>
              <button
                onClick={() => navigate(-1)}
                aria-label="Go back"
                className="grid h-10 w-10 place-items-center rounded-lg bg-white/70 text-primary-light transition hover:bg-white"
              >
                <FaArrowLeft />
              </button>
              <div className="min-w-0">
                <p className="text-sm font-bold text-primary truncate max-w-[140px] sm:max-w-none">Welcome back, {user?.name?.split(' ')[0]}</p>
                <p className="hidden text-xs text-primary/50 sm:block truncate">Municipal operations console</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <NotificationsBell />
              <NotificationToastWatcher />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-8">
          <Outlet />
        </main>
      </div>

      {}
      {mobileOpen && (
        <button
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
          className="fixed right-4 top-4 z-50 grid h-10 w-10 place-items-center rounded-lg bg-white/10 text-white lg:hidden"
        >
          <FaTimes />
        </button>
      )}
    </div>
  );
}
