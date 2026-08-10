import { Link, NavLink } from "react-router-dom";
import { FaCamera, FaRoad, FaUserCog } from "react-icons/fa";
import { useState } from "react";
import { useAuth } from "../../features/auth/auth-context";

const links = [
  { to: "/", label: "Home" },
  { to: "/map", label: "Map" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-white/40 bg-white/70 backdrop-blur-lg">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link
          to="/"
          className="flex items-center gap-2 text-xl font-extrabold text-primary"
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-accent">
            <FaRoad />
          </span>
          RoadGuard
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `text-sm font-semibold transition ${isActive ? "text-accent" : "text-primary/70 hover:text-primary"}`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <>
              <Link
                to={user.role === 'ADMIN' ? '/admin/dashboard' : '/dashboard'}
                className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-accent-light"
              >
                Dashboard
              </Link>
              <Link
                to="/report"
                className="flex items-center gap-2 rounded-lg border border-primary/15 px-3 py-2 text-sm font-semibold text-primary/70 transition hover:border-accent hover:text-accent"
              >
                <FaCamera /> Report
              </Link>
              <Link
                to="/profile"
                className="flex items-center gap-2 rounded-lg border border-primary/15 px-3 py-2 text-sm font-semibold text-primary/70 transition hover:border-accent hover:text-accent"
              >
                <FaUserCog /> Profile
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="text-sm font-semibold text-primary/70 hover:text-primary"
              >
                Log in
              </Link>
              <Link
                to="/register"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-primary-light"
              >
                Report a hazard
              </Link>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          className="rounded-lg p-2 text-primary md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </nav>

      {open && (
        <div className="border-t border-white/40 bg-white/90 px-4 py-3 md:hidden">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              onClick={() => setOpen(false)}
              className="block py-2 text-sm font-semibold text-primary"
            >
              {l.label}
            </NavLink>
          ))}
          {user && (
            <Link
              to="/profile"
              onClick={() => setOpen(false)}
              className="mt-2 flex items-center gap-2 rounded-lg border border-primary/15 px-3 py-2 text-sm font-semibold text-primary/70 transition hover:border-accent hover:text-accent"
            >
              <FaUserCog /> Profile settings
            </Link>
          )}
          <div className="mt-2 flex gap-3">
            {user ? (
              <>
                <Link
                  to={user.role === 'ADMIN' ? '/admin/dashboard' : '/dashboard'}
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-lg bg-accent py-2 text-center text-sm font-semibold text-white"
                >
                  Dashboard
                </Link>
                <Link
                  to="/report"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-lg border border-primary/20 py-2 text-center text-sm font-semibold"
                >
                  Report
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="flex-1 rounded-lg border border-primary/20 py-2 text-center text-sm font-semibold"
                >
                  Log in
                </Link>
                <Link
                  to="/register"
                  className="flex-1 rounded-lg bg-primary py-2 text-center text-sm font-semibold text-white"
                >
                  Report a hazard
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
