import { Link } from 'react-router-dom';
import { FaRoad } from 'react-icons/fa';

export function NotFound() {
  return (
    <div className="grid min-h-[70vh] place-items-center px-4">
      <div className="text-center">
        <span className="text-7xl font-extrabold text-accent/40">404</span>
        <h1 className="mt-4 text-2xl font-extrabold text-primary">The road you took is broken</h1>
        <p className="mx-auto mt-2 max-w-sm text-primary/60">
          This page doesn't exist. Let's get you back on the map.
        </p>
        <Link
          to="/"
          className="mt-8 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-white transition hover:bg-primary-light"
        >
          <FaRoad /> Back home
        </Link>
      </div>
    </div>
  );
}
