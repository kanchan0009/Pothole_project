import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
  FaUserCog,
} from 'react-icons/fa';
import { reportsApi } from '../api/reports';
import { useAuth } from '../features/auth/auth-context';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Skeleton, SkeletonRow } from '../components/ui/Skeleton';
import { ReportDetailDrawer } from '../components/user/ReportDetailDrawer';
import { SEVERITY_META, STATUS_META, STATUS_ORDER } from '../lib/constants';
import { timeAgo } from '../lib/format';
import type { ReportStatus, Severity } from '../types';
import { DashboardHero } from '../components/dashboard/DashboardHero';
import { SparklineCard } from '../components/dashboard/SparklineCard';
import { QuickActionCard } from '../components/dashboard/QuickActionCard';

const PAGE_SIZE = 8;

const TABS: { key: ReportStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  ...STATUS_ORDER.map((s) => ({ key: s, label: STATUS_META[s].label })),
];

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
  const [searchParams, setSearchParams] = useSearchParams();
  const initialId = searchParams.get('reportId') ? parseInt(searchParams.get('reportId')!, 10) : null;

  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<ReportStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(initialId);

  useEffect(() => {
    const id = searchParams.get('reportId');
    if (id) {
       setSelectedId(parseInt(id, 10));
    }
  }, [searchParams]);

  const handleDrawerClose = () => {
    setSelectedId(null);
    if (searchParams.has('reportId')) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('reportId');
      setSearchParams(newParams);
    }
  };

  const { data: stats } = useQuery({ queryKey: ['user', 'stats'], queryFn: reportsApi.mineStats });

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [status, debouncedSearch]);

  const listQueryKey = useMemo(
    () =>
      [
        'user',
        'reports',
        {
          page,
          limit: PAGE_SIZE,
          status: status === 'all' ? null : status,
          search: debouncedSearch || null,
        },
      ] as const,
    [page, status, debouncedSearch],
  );

  const {
    data,
    isLoading,
    isError,
    error,
    isFetching,
  } = useQuery({
    queryKey: listQueryKey,
    queryFn: ({ queryKey }) => {
      const [, , filters] = queryKey as [
        'user',
        'reports',
        {
          page: number;
          limit: number;
          status: ReportStatus | null;
          search: string | null;
        },
      ];
      return reportsApi.mine({
        page: filters.page,
        limit: filters.limit,
        status: filters.status ?? undefined,
        search: filters.search || undefined,
      });
    },
  });

  const reports = data?.reports ?? [];

  const s = stats?.status;
  const inProgress = s ? s.assigned + s.inProgress : 0;
  const totalPages = data?.pagination.totalPages ?? 1;
  const activeTabLabel = status === 'all' ? 'All' : STATUS_META[status].label;

  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
      
      {/* Hero Section */}
      <DashboardHero
        title={`Welcome back, ${user?.name?.split(' ')[0] ?? 'Citizen'}`}
        subtitle="Track your reports and follow their repair progress."
        dateStr={dateStr}
        onRefresh={() => window.location.reload()}
        stats={[
          {
            label: "Total Reports",
            value: s ? s.total : <Skeleton className="h-8 w-16 bg-white/20" />,
            icon: <FaClipboardList />,
          },
          {
            label: "Repaired",
            value: s ? s.completed : <Skeleton className="h-8 w-16 bg-white/20" />,
            icon: <FaCheckDouble />,
          },
          {
            label: "In Progress",
            value: s ? inProgress : <Skeleton className="h-8 w-16 bg-white/20" />,
            icon: <FaSpinner />,
          },
          {
            label: "Community Rank",
            value: "Top 15%",
            icon: <FaUserCog />,
          },
        ]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:grid-cols-4">
        <SparklineCard
          label="Total Reports"
          value={s ? s.total : 0}
          icon={<FaClipboardList />}
          iconBg="bg-dashboard-blue/10"
          iconColor="text-dashboard-blue"
          progress={100}
          progressColor="bg-dashboard-blue"
        />
        <SparklineCard
          label="Pending Review"
          value={s ? s.pending : 0}
          icon={<FaHourglassHalf />}
          iconBg="bg-dashboard-orange/10"
          iconColor="text-dashboard-orange"
          progress={s?.total ? ((s.pending / s.total) * 100) : 0}
          progressColor="bg-dashboard-orange"
        />
        <SparklineCard
          label="In Progress"
          value={inProgress}
          icon={<FaSpinner />}
          iconBg="bg-dashboard-purple/10"
          iconColor="text-dashboard-purple"
          progress={s?.total ? ((inProgress / s.total) * 100) : 0}
          progressColor="bg-dashboard-purple"
        />
        <SparklineCard
          label="Completed"
          value={s ? s.completed : 0}
          icon={<FaCheckDouble />}
          iconBg="bg-dashboard-green/10"
          iconColor="text-dashboard-green"
          progress={s?.total ? ((s.completed / s.total) * 100) : 0}
          progressColor="bg-dashboard-green"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main List */}
        <div className="lg:col-span-2">
          <Card className="flex h-full flex-col p-0">
            <div className="border-b border-primary/5 p-5">
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
                <div className="flex flex-wrap gap-1 rounded-lg border border-primary/10 p-1">
                  {TABS.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setStatus(t.key)}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                        status === t.key ? 'bg-primary text-white' : 'text-primary/60 hover:text-primary hover:bg-primary/5'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-hidden">
              {isLoading ? (
                <div className="px-5 py-4">
                  <SkeletonRow lines={PAGE_SIZE} />
                </div>
              ) : isError ? (
                <div className="px-5 py-14 text-center">
                  <p className="text-sm font-semibold text-primary/70">Could not load your reports</p>
                  <p className="mt-1 text-xs text-primary/50">
                    {error instanceof Error ? error.message : 'Please refresh and try again.'}
                  </p>
                </div>
              ) : reports.length === 0 ? (
                <div className="px-5 py-14 text-center">
                  <p className="text-sm font-semibold text-primary/70">
                    {status === 'all' ? 'No reports yet.' : `No ${activeTabLabel.toLowerCase()} reports.`}
                  </p>
                  <p className="mt-1 text-xs text-primary/50">
                    {status === 'all'
                      ? 'Spot a pothole? Let the municipality know.'
                      : 'Try another status tab or submit a new report.'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-primary/5">
                  {reports.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setSelectedId(r.id)}
                      className="flex flex-col sm:flex-row w-full sm:items-center gap-3 sm:gap-4 px-5 py-4 text-left transition hover:bg-primary/[0.02]"
                    >
                      <div className="flex w-full items-center gap-3 sm:gap-4">
                        <img src={r.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover shadow-sm" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-bold text-primary">{r.title}</p>
                            {r.duplicate && (
                              <Badge tone="warning">
                                <FaFlag /> Duplicate
                              </Badge>
                            )}
                          </div>
                          <p className="mt-0.5 truncate text-[11px] text-primary/50">
                            {r.roadName} · {r.municipality} · {timeAgo(r.createdAt)}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex w-full sm:w-auto items-center justify-between sm:justify-end gap-3 pl-15 sm:pl-0">
                        <div className="sm:hidden text-xs text-primary/50">
                           {timeAgo(r.createdAt)}
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="hidden sm:block">
                            <SeverityChip severity={r.severity} />
                          </div>
                          <Badge tone={STATUS_META[r.status].tone}>{STATUS_META[r.status].label}</Badge>
                          <FaChevronRight className="shrink-0 text-primary/20" />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-primary/5 px-5 py-4">
              <p className="text-[11px] font-semibold text-primary/40">
                {isLoading
                  ? 'LOADING…'
                  : isError
                    ? '—'
                    : `${data?.pagination.total ?? reports.length} REPORT${(data?.pagination.total ?? reports.length) === 1 ? '' : 'S'}${isFetching ? ' · updating…' : ''}`}
              </p>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="outline" className="h-8 px-2" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <FaChevronLeft />
                </Button>
                <span className="px-3 text-xs font-bold text-primary/60">
                  {page} / {totalPages}
                </span>
                <Button size="sm" variant="outline" className="h-8 px-2" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  <FaChevronRight />
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Quick Actions Side Column */}
        <div>
          <Card className="p-6">
            <h3 className="mb-6 text-base font-extrabold text-primary">Quick Actions</h3>
            <div className="space-y-4">
              <Link to="/report" className="block">
                <QuickActionCard
                  title="Report a Hazard"
                  subtitle="Snap a photo of a pothole"
                  icon={<FaCamera />}
                  bgColor="bg-dashboard-blue"
                />
              </Link>
              <Link to="/profile" className="block">
                <QuickActionCard
                  title="Profile Settings"
                  subtitle="Update your contact info"
                  icon={<FaUserCog />}
                  bgColor="bg-dashboard-purple"
                />
              </Link>
            </div>
          </Card>
        </div>
      </div>

      <ReportDetailDrawer reportId={selectedId} onClose={handleDrawerClose} />
    </motion.div>
  );
}
