import { Link } from 'react-router-dom';
import { FaRoad } from 'react-icons/fa';

export function Footer() {
  return (
    <footer className="bg-primary text-white/70">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2 text-lg font-extrabold text-white">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent/20 text-accent">
              <FaRoad />
            </span>
            RoadGuard
          </div>
          <p className="mt-3 max-w-xs text-sm">
            A citizen-driven pothole detection and reporting platform helping municipalities fix roads faster.
          </p>
        </div>
        <div>
          <h4 className="text-sm font-bold uppercase tracking-wider text-white">Platform</h4>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link to="/map" className="hover:text-accent">Public map</Link></li>
            <li><Link to="/login" className="hover:text-accent">Citizen login</Link></li>
            <li><Link to="/admin" className="hover:text-accent">Admin portal</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-bold uppercase tracking-wider text-white">Contact</h4>
          <p className="mt-3 text-sm">
            Municipal Works Department
            <br />
            support@roadguard.gov
          </p>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs">
        © {new Date().getFullYear()} RoadGuard · Smart Pothole Detection &amp; Reporting System
      </div>
    </footer>
  );
}
