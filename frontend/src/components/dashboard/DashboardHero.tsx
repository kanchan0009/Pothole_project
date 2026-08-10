import type { ReactNode } from 'react';
import { FaSyncAlt, FaFileExport } from 'react-icons/fa';


interface HeroStat {
  label: string;
  value: ReactNode;
  trend?: string;
  icon?: ReactNode;
}

interface DashboardHeroProps {
  title: string;
  subtitle: string;
  dateStr: string;
  stats: HeroStat[];
  onRefresh?: () => void;
  onExport?: () => void;
}

export function DashboardHero({ title, subtitle, dateStr, stats, onRefresh, onExport }: DashboardHeroProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#0f284e] p-6 text-white shadow-lg lg:p-8">
      {/* Decorative abstract wave/shape */}
      <div className="pointer-events-none absolute right-0 top-0 h-full w-1/2 opacity-10">
        <svg viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full object-cover">
          <circle cx="200" cy="200" r="150" stroke="white" strokeWidth="40" />
          <circle cx="350" cy="50" r="100" stroke="white" strokeWidth="20" />
        </svg>
      </div>

      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">{title}</h1>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-md">
              {dateStr}
            </span>
          </div>
          <p className="text-sm text-white/70">{subtitle}</p>
        </div>

        <div className="flex gap-2">
          {onExport && (
            <button
              onClick={onExport}
              className="flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold transition hover:bg-white/20"
            >
              <FaFileExport /> Export
            </button>
          )}
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 transition hover:bg-white/20"
              aria-label="Refresh data"
            >
              <FaSyncAlt className="text-sm" />
            </button>
          )}
        </div>
      </div>

      <div className="relative z-10 mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <div key={i} className="rounded-xl bg-white/10 p-4 backdrop-blur-md border border-white/10">
            <div className="mb-2 flex items-center gap-2 text-white/70">
              {stat.icon && <span className="text-accent">{stat.icon}</span>}
              <p className="text-xs font-semibold">{stat.label}</p>
            </div>
            <p className="text-2xl font-bold">{stat.value}</p>
            {stat.trend && <p className="mt-1 text-[11px] text-white/50">{stat.trend}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
