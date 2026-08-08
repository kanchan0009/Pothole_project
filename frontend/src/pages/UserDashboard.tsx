import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  FaCamera,
  FaCheckDouble,
  FaChevronLeft,
  FaChevronRight,
  FaClipboardList,
  FaFlag,
  FaHourglassHalf,
  FaSearch,
  FaSpinner,
} from 'react-icons/fa';
import { reportsApi } from '../api/reports';
import { useAuth } from '../features/auth/auth-context';
import { NotificationsBell } from '../components/ui/NotificationsBell';
import { NotificationToastWatcher } from '../components/ui/NotificationToastWatcher';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Skeleton, SkeletonRow } from '../components/ui/Skeleton';
import { ReportDetailDrawer } from '../components/user/ReportDetailDrawer';
import { SEVERITY_META, STATUS_META, STATUS_ORDER } from '../lib/constants';
import { timeAgo } from '../lib/format';
import { reportRef } from '../lib/receipt';
import type { ReportStatus, Severity } from '../types';

const PAGE_SIZE = 8;

const TABS: { key: ReportStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  ...STATUS_ORDER.map((s) => ({ key: s, label: STATUS_META[s].label })),
];

function StatCard({ label, value, icon, accent }: { label: string; value: ReactNode; icon: ReactNode; accent: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[11px] font-bold uppercase tracking-wider text-primary/50">{label}</p>
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs text-white ${accent}`}>{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-extrabold text-primary">{value}</p>
    </Card>
  );
}

function SeverityChip({ severity }: { severity: Severity }) {
  const meta = SEVERITY_META[severity];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-bold" style={{ color: meta.color }}>
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.color }} />
      {meta.label}
    </span>
  );
}

export function UserDashboard() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<ReportStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Summary cards — independent of the filtered list.
  const { data: stats } = useQuery({ queryKey: ['user', 'stats'], queryFn: reportsApi.mineStats });

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  // Any filter change starts back at page 1.
  useEffect(() => {
    setPage(1);
  }, [status, debouncedSearch]);

  const params = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      status: status === 'all' ? undefined : status,
      search: debouncedSearch || undefined,
    }),
    [page, status, debouncedSearch]
  );

  const { data, isFetching } = useQuery({
    queryKey: ['user', 'reports', params],
    queryFn: () => reportsApi.mine(params),
    placeholderData: (prev) => prev,
  });

  const s = stats?.status;
  const inProgress = s ? s.assigned + s.inProgress : null;
  const totalPages = data?.pagination.totalPages ?? 1;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-primary">Welcome back, {user?.name?.split(' ')[0] ?? 'Citizen'}</h1>
          <p className="mt-1 text-sm text-primary/60">Track your reports and follow their repair progress.</p>
        </div>
        <div className="flex items-center gap-3">
          <NotificationsBell />
          <NotificationToastWatcher />
          <Link to="/report" className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-accent-light">
            <FaCamera /> Report a hazard
          </Link>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total reports" value={s ? s.total : <Skeleton className="h-7 w-10" />} icon={<FaClipboardList />} accent="bg-primary" />
        <StatCard label="Pending review" value={s ? s.pending : <Skeleton className="h-7 w-10" />} icon={<FaHourglassHalf />} accent="bg-warning" />
        <StatCard label="In progress" value={inProgress != null ? inProgress : <Skeleton className="h-7 w-10" />} icon={<FaSpinner />} accent="bg-orange-500" />
        <StatCard label="Completed" value={s ? s.completed : <Skeleton className="h-7 w-10" />} icon={<FaCheckDouble />} accent="bg-success" />
      </div>

      {/* Filters */}
      <Card className="mt-6 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-52 flex-1">
            <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-primary/35" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search your reports…"
              className="input-field h-10 pl-9 text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setStatus(t.key)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
                  status === t.key ? 'bg-primary text-white' : 'text-primary/60 hover:text-primary'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* My reports */}
      <Card className="mt-4 overflow-hidden">
        {isFetching && !data ? (
          <div className="px-5 py-4">
            <SkeletonRow lines={PAGE_SIZE} />
          </div>
        ) : (data?.reports ?? []).length === 0 ? (
          <div className="px-5 py-14 text-center">
            <p className="text-sm font-semibold text-primary/70">No reports yet.</p>
            <p className="mt-1 text-xs text-primary/50">Spot a pothole? Let the municipality know.</p>
            <Link
              to="/report"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-accent-light"
            >
              <FaCamera /> Report a hazard
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-primary/5">
            {(data?.reports ?? []).map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-primary/[0.03]"
              >
                <img src={r.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-bold text-primary">{r.title}</p>
                    {r.duplicate && (
                      <Badge tone="warning">
                        <FaFlag /> Duplicate
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-primary/50">
                    {r.roadName} · {r.municipality} · Ward {r.ward}
                  </p>
                  <div className="mt-1.5 flex items-center gap-3">
                    <SeverityChip severity={r.severity} />
                    <span className="text-[11px] font-semibold text-primary/40">Priority {r.priorityScore}</span>
                    <span className="text-[11px] text-primary/40">· {reportRef(r.id)}</span>
                    <span className="text-[11px] text-primary/40">· {timeAgo(r.createdAt)}</span>
                  </div>
                </div>
                <Badge tone={STATUS_META[r.status].tone}>{STATUS_META[r.status].label}</Badge>
                <FaChevronRight className="shrink-0 text-primary/30" />
              </button>
            ))}
          </div>
        )}

        {/* Pagination */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-primary/5 px-5 py-4">
          <p className="text-xs text-primary/50">
            {data ? `${data.pagination.total} total report${data.pagination.total === 1 ? '' : 's'}` : 'Loading…'}
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <FaChevronLeft /> Prev
            </Button>
            <span className="px-1 text-xs font-semibold text-primary/60">
              Page {page} of {totalPages}
            </span>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next <FaChevronRight />
            </Button>
          </div>
        </div>
      </Card>

      <ReportDetailDrawer reportId={selectedId} onClose={() => setSelectedId(null)} />
    </motion.div>
  );
}
