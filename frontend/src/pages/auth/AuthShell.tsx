import { Link } from 'react-router-dom';
import { FaRoad } from 'react-icons/fa';
import type { ReactNode } from 'react';

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}


export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      {}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-primary p-12 text-white lg:flex">
        <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-accent/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />
        <Link to="/" className="relative flex items-center gap-2 text-2xl font-extrabold">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/20 text-accent">
            <FaRoad />
          </span>
          RoadGuard
        </Link>
        <div className="relative">
          <h2 className="text-3xl font-extrabold leading-snug">
            Report a hazard.
            <br />
            Watch it get fixed.
          </h2>
          <p className="mt-4 max-w-sm text-white/60">
            Join the citizen platform helping municipalities keep roads safe with photos, GPS, and
            transparent tracking.
          </p>
        </div>
        <p className="relative text-xs text-white/40">© {new Date().getFullYear()} RoadGuard</p>
      </div>

      {}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 flex items-center gap-2 text-xl font-extrabold text-primary lg:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-accent">
              <FaRoad />
            </span>
            RoadGuard
          </Link>
          <h1 className="text-2xl font-extrabold text-primary">{title}</h1>
          <p className="mt-2 text-sm text-primary/60">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
