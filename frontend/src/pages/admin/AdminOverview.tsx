import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import {
  FaBan,
  FaCalendarAlt,
  FaCalendarDay,
  FaCheckCircle,
  FaCheckDouble,
  FaClipboardList,
  FaClock,
  FaHourglassHalf,
  FaRobot,
  FaSpinner,
  FaUserCog,
} from 'react-icons/fa';
import { adminApi, type StatisticsPeriod } from '../../api/admin';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { SeverityDoughnut, TopRoadsBar, TrendLine } from '../../components/admin/Charts';
import { Heatmap } from '../../components/admin/Heatmap';
import { STATUS_META } from '../../lib/constants';
import { formatHours, timeAgo } from '../../lib/format';
import type { StatusCounts } from '../../types';
import { useMemo, useState } from 'react';

const PERIODS: { key: StatisticsPeriod; label: string }[] = [
  { key: 'day', label: 'Daily' },
  { key: 'week', label: 'Weekly' },
  { key: 'month', label: 'Monthly' },
  { key: 'year', label: 'Yearly' },
];

function StatCard({ label, value, icon, accent, hint }: { label: string; value: ReactNode; icon: ReactNode; accent: string; hint?: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs font-bold uppercase tracking-wider text-primary/50">{label}</p>
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm text-white ${accent}`}>{icon}</span>
      </div>
      <p className="mt-3 text-2xl font-extrabold text-primary xl:text-3xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-primary/50">{hint}</p>}
    </Card>
  );
}

function CardsGrid({
  counts,
  today,
  monthly,
  avg,
  aiAccuracy,
}: {
  counts: StatusCounts;
  today: number;
  monthly: number;
  avg: number | null;
  aiAccuracy: number | null;
}) {
  const cards: { key: keyof StatusCounts; label: string; icon: ReactNode; accent: string }[] = [
    { key: 'total', label: 'Total reports', icon: <FaClipboardList />, accent: 'bg-primary' },
    { key: 'pending', label: 'Pending', icon: <FaHourglassHalf />, accent: 'bg-warning' },
    { key: 'verified', label: 'Verified', icon: <FaCheckCircle />, accent: 'bg-blue-500' },
    { key: 'assigned', label: 'Assigned', icon: <FaUserCog />, accent: 'bg-purple-600' },
    { key: 'inProgress', label: 'In progress', icon: <FaSpinner />, accent: 'bg-orange-500' },
    { key: 'completed', label: 'Completed', icon: <FaCheckDouble />, accent: 'bg-success' },
    { key: 'rejected', label: 'Rejected', icon: <FaBan />, accent: 'bg-slate-500' },
  ];
  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {cards.map((c) => (
          <StatCard key={c.key} label={c.label} value={counts[c.key] ?? 0} icon={c.icon} accent={c.accent} />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Today's reports" value={today} icon={<FaCalendarDay />} accent="bg-accent" />
        <StatCard label="This month" value={monthly} icon={<FaCalendarAlt />} accent="bg-primary-light" />
        <StatCard label="Avg resolution" value={formatHours(avg)} icon={<FaClock />} accent="bg-primary" hint="time to completion" />
        <StatCard
          label="AI accuracy"
          value={aiAccuracy == null ? '—' : `${aiAccuracy}%`}
          icon={<FaRobot />}
          accent="bg-accent"
          hint="confirmed detections of those reviewed"
        />
      </div>
    </>
  );
}

function CardsSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-card" />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-card" />
        ))}
      </div>
    </>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <Card className="p-5">
      <div className="mb-4">
        <h3 className="text-base font-extrabold text-primary">{title}</h3>
        {subtitle && <p className="text-xs text-primary/50">{subtitle}</p>}
      </div>
      {children}
    </Card>
  );
}

export function AdminOverview() {
  const [period, setPeriod] = useState<StatisticsPeriod>('month');

  const { data: dash, isLoading: dashLoading } = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: adminApi.dashboard,
  });
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin', 'statistics', period],
    queryFn: () => adminApi.statistics(period),
  });

  const activity = useMemo(() => dash?.recentActivity ?? [], [dash]);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-primary">Dashboard overview</h1>
          <p className="mt-1 text-sm text-primary/60">Live picture of pothole reports across the municipality.</p>
        </div>
        <div className="flex rounded-lg border border-primary/10 bg-white p-1 text-sm font-semibold">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`rounded-md px-3 py-1.5 transition ${
                period === p.key ? 'bg-primary text-white' : 'text-primary/60 hover:text-primary'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {dashLoading || !dash ? (
        <CardsSkeleton />
      ) : (
        <CardsGrid
          counts={dash.counts}
          today={dash.today}
          monthly={dash.monthly}
          avg={dash.avgResolutionHours}
          aiAccuracy={stats?.aiAccuracy ?? null}
        />
      )}

      {/* Charts row */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <ChartCard title="Report volume" subtitle={`Trend by ${period}`} >
          {statsLoading || !stats ? (
            <Skeleton className="h-[260px] w-full" />
          ) : (
            <TrendLine labels={stats.timeSeries.map((p) => p.label)} data={stats.timeSeries.map((p) => p.count)} />
          )}
        </ChartCard>
        <ChartCard title="Severity distribution">
          {statsLoading || !stats ? (
            <Skeleton className="h-[260px] w-full" />
          ) : (
            <SeverityDoughnut data={stats.severity} />
          )}
        </ChartCard>
      </div>

      {/* Heatmap + top roads */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ChartCard title="Complaint heat map" subtitle="Geographic density of all reports">
          {statsLoading || !stats ? (
            <Skeleton className="h-72 w-full" />
          ) : (
            <Heatmap points={stats.heatmap} />
          )}
        </ChartCard>
        <ChartCard title="Most damaged roads" subtitle="Roads with the most reports">
          {statsLoading || !stats ? (
            <Skeleton className="h-72 w-full" />
          ) : (
            <TopRoadsBar labels={stats.topRoads.map((r) => r.roadName)} data={stats.topRoads.map((r) => r.count)} />
          )}
        </ChartCard>
      </div>

      {/* Most active users + hotspots */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ChartCard title="Most active users" subtitle="Citizens who reported the most">
          {statsLoading || !stats ? (
            <Skeleton className="h-72 w-full" />
          ) : stats.topUsers.length === 0 ? (
            <p className="py-16 text-center text-sm text-primary/50">No reports yet.</p>
          ) : (
            <TopRoadsBar labels={stats.topUsers.map((u) => u.name)} data={stats.topUsers.map((u) => u.count)} />
          )}
        </ChartCard>
        <ChartCard title="Hotspot areas" subtitle="Municipalities and wards with the most complaints">
          {statsLoading || !stats ? (
            <Skeleton className="h-72 w-full" />
          ) : (
            <ol className="divide-y divide-primary/5">
              {stats.topAreas.slice(0, 8).map((a, i) => (
                <li key={`${a.municipality}-${a.ward}`} className="flex items-center gap-3 py-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-xs font-extrabold text-accent">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-primary">{a.municipality}</p>
                    <p className="truncate text-xs text-primary/50">Ward {a.ward}</p>
                  </div>
                  <Badge tone="neutral">{a.count} reports</Badge>
                </li>
              ))}
              {stats.topAreas.length === 0 && (
                <p className="py-16 text-center text-sm text-primary/50">No reports yet.</p>
              )}
            </ol>
          )}
        </ChartCard>
      </div>

      {/* Recent reports + activity */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-extrabold text-primary">Recent reports</h3>
            <Link to="/admin/dashboard/reports" className="text-sm font-semibold text-accent hover:underline">
              View all →
            </Link>
          </div>
          {dashLoading || !dash ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="divide-y divide-primary/5">
              {dash.recentReports.map((r) => (
                <div key={r.id} className="flex items-center gap-4 py-3">
                  <img src={r.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-primary">{r.title}</p>
                    <p className="truncate text-xs text-primary/50">
                      {r.roadName} · {r.municipality} · {timeAgo(r.createdAt)}
                    </p>
                  </div>
                  <Badge tone={STATUS_META[r.status].tone}>{STATUS_META[r.status].label}</Badge>
                </div>
              ))}
              {dash.recentReports.length === 0 && (
                <p className="py-8 text-center text-sm text-primary/50">No reports yet.</p>
              )}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="mb-4 text-base font-extrabold text-primary">Latest activity</h3>
          {dashLoading || !dash ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <ol className="relative space-y-4 border-l border-primary/10 pl-4">
              {activity.map((a) => (
                <li key={a.id} className="relative">
                  <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-accent ring-4 ring-accent/15" />
                  <p className="text-sm font-semibold text-primary">
                    {a.action.replace(/_/g, ' ').toLowerCase()} <span className="text-primary/40">by {a.adminName}</span>
                  </p>
                  <p className="text-xs text-primary/60">{a.details}</p>
                  <p className="mt-0.5 text-[11px] text-primary/40">{timeAgo(a.createdAt)}</p>
                </li>
              ))}
              {activity.length === 0 && <p className="text-sm text-primary/50">No admin activity yet.</p>}
            </ol>
          )}
        </Card>
      </div>
    </motion.div>
  );
}
