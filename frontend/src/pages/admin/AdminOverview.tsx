import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import {
  FaBan,
  FaCalendarAlt,
  FaCheckDouble,
  FaClipboardList,
  FaClock,
  FaCog,
  FaFileExport,
  FaHourglassHalf,
  FaChartBar,
  FaRobot,
  FaUserCog,
  FaUsers,
} from 'react-icons/fa';
import { adminApi, type StatisticsPeriod } from '../../api/admin';
import { Card } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { TrendLine } from '../../components/admin/Charts';
import { formatHours, timeAgo } from '../../lib/format';
import { DashboardHero } from '../../components/dashboard/DashboardHero';
import { SparklineCard } from '../../components/dashboard/SparklineCard';
import { QuickActionCard } from '../../components/dashboard/QuickActionCard';

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Card className="p-6 h-full flex flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-extrabold text-primary">{title}</h3>
          {subtitle && <p className="text-xs text-primary/50">{subtitle}</p>}
        </div>
      </div>
      <div className="flex-1">{children}</div>
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


  const totalReports = dash?.counts?.total ?? 0;
  const pendingReports = dash?.counts?.pending ?? 0;
  const inProgress = (dash?.counts?.assigned ?? 0) + (dash?.counts?.inProgress ?? 0);
  const completed = dash?.counts?.completed ?? 0;


  const todayProgress = totalReports > 0 ? ((dash?.today ?? 0) / totalReports) * 100 : 0;
  const pendingProgress = totalReports > 0 ? (pendingReports / totalReports) * 100 : 0;

  const avgResolution = dash?.avgResolutionHours;
  const aiAcc = stats?.aiAccuracy;

  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">

      { }
      <DashboardHero
        title="Welcome back, Admin"
        subtitle="Here's your platform performance overview"
        dateStr={dateStr}
        onExport={() => alert('Exporting data...')}
        onRefresh={() => window.location.reload()}
        stats={[
          {
            label: "Today's Reports",
            value: dash?.today ?? <Skeleton className="h-8 w-16 bg-white/20" />,
            trend: "+12% from yesterday",
            icon: <FaCalendarAlt />,
          },
          {
            label: "Pending Action",
            value: pendingReports,
            trend: "Requires attention",
            icon: <FaHourglassHalf />,
          },
          {
            label: "Avg Resolution",
            value: avgResolution != null ? formatHours(avgResolution) : <Skeleton className="h-8 w-16 bg-white/20" />,
            trend: "-5% from last week",
            icon: <FaClock />,
          },
          {
            label: "AI Accuracy",
            value: aiAcc != null ? `${aiAcc}%` : <Skeleton className="h-8 w-16 bg-white/20" />,
            trend: "+2% from yesterday",
            icon: <FaRobot />,
          },
        ]}
      />

      { }
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:grid-cols-4">
        <SparklineCard
          label="Total Reports"
          value={totalReports}
          icon={<FaClipboardList />}
          iconBg="bg-dashboard-blue/10"
          iconColor="text-dashboard-blue"
          trend="+12.5%"
          progress={todayProgress}
          progressColor="bg-dashboard-blue"
          sublabel1="Today"
          subvalue1={dash?.today?.toString() ?? '0'}
          sublabel2="vs last month"
          subvalue2={dash?.monthly?.toString() ?? '0'}
        />
        <SparklineCard
          label="Pending Review"
          value={pendingReports}
          icon={<FaHourglassHalf />}
          iconBg="bg-dashboard-orange/10"
          iconColor="text-dashboard-orange"
          trend="-2.4%"
          trendColor="text-dashboard-red bg-dashboard-red/10"
          progress={pendingProgress}
          progressColor="bg-dashboard-orange"
          sublabel1="Action required"
          subvalue1=""
        />
        <SparklineCard
          label="In Progress"
          value={inProgress}
          icon={<FaUserCog />}
          iconBg="bg-dashboard-purple/10"
          iconColor="text-dashboard-purple"
          trend="+8.2%"
          progress={(inProgress / Math.max(1, totalReports)) * 100}
          progressColor="bg-dashboard-purple"
        />
        <SparklineCard
          label="Completed"
          value={completed}
          icon={<FaCheckDouble />}
          iconBg="bg-dashboard-green/10"
          iconColor="text-dashboard-green"
          trend="+23.1%"
          progress={(completed / Math.max(1, totalReports)) * 100}
          progressColor="bg-dashboard-green"
          sublabel1="Success rate"
          subvalue1={`${Math.round((completed / Math.max(1, totalReports)) * 100)}%`}
        />
      </div>

      { }
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCard title="Report Volume Analytics" subtitle="Comprehensive report submission metrics">
            <div className="mb-6 flex justify-end">
              <div className="flex rounded-lg border border-primary/10 bg-background p-1 text-xs font-semibold">
                {['day', 'week', 'month', 'year'].map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p as StatisticsPeriod)}
                    className={`rounded-md px-3 py-1.5 transition ${period === p ? 'bg-primary text-white' : 'text-primary/60 hover:text-primary'
                      }`}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            {statsLoading || !stats ? (
              <Skeleton className="h-[260px] w-full" />
            ) : (
              <TrendLine labels={stats.timeSeries.map((p) => p.label)} data={stats.timeSeries.map((p) => p.count)} />
            )}
          </ChartCard>
        </div>

        <div>
          <Card className="h-full p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-extrabold text-primary">Live Activity</h3>
              <span className="flex items-center gap-1.5 text-xs font-bold text-dashboard-green">
                <span className="h-2 w-2 rounded-full bg-dashboard-green animate-pulse" /> Live
              </span>
            </div>
            {dashLoading || !dash ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <div className="relative mt-4">
                <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-primary/5" />
                <ol className="space-y-6">
                  {activity.slice(0, 4).map((a) => (
                    <li key={a.id} className="relative pl-8">
                      <span className="absolute left-0 top-1 grid h-6 w-6 place-items-center rounded-full bg-dashboard-blue/10 text-[10px] text-dashboard-blue ring-4 ring-white">
                        <FaClipboardList />
                      </span>
                      <p className="text-sm text-primary">
                        <span className="font-bold">{a.adminName}</span> {a.action.replace(/_/g, ' ').toLowerCase()}
                      </p>
                      <p className="text-xs text-primary/50 mt-0.5">{a.details}</p>
                      <p className="mt-1 text-[10px] font-semibold text-primary/40">{timeAgo(a.createdAt)}</p>
                    </li>
                  ))}
                  {activity.length === 0 && <p className="text-sm text-primary/50 pl-2">No admin activity yet.</p>}
                </ol>
                {activity.length > 0 && (
                  <div className="mt-6 text-center">
                    <Link to="/admin/dashboard/reports" className="text-xs font-bold text-dashboard-blue hover:underline">
                      View All Activities
                    </Link>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>

      { }
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="h-full p-6">
            <div className="grid grid-cols-2 gap-4">
              <QuickActionCard
                title="Manage Users"
                subtitle="Review pending citizen accounts"
                icon={<FaUsers />}
                bgColor="bg-dashboard-blue"
                onClick={() => { }}
              />
              <QuickActionCard
                title="View Analytics"
                subtitle="Analyze report data"
                icon={<FaChartBar />}
                bgColor="bg-dashboard-green"
                onClick={() => { }}
              />
              <QuickActionCard
                title="Export Reports"
                subtitle="Generate CSV analytics data"
                icon={<FaFileExport />}
                bgColor="bg-dashboard-orange"
                onClick={() => { }}
              />
              <QuickActionCard
                title="System Settings"
                subtitle="Configure app parameters"
                icon={<FaCog />}
                bgColor="bg-dashboard-purple"
                onClick={() => { }}
              />
            </div>
          </Card>
        </div>

        <div>
          <Card className="h-full p-6">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-base font-extrabold text-primary">Top Areas</h3>
              <Link to="/admin/dashboard/reports" className="text-xs font-bold text-dashboard-blue hover:underline">
                View All &rarr;
              </Link>
            </div>
            {statsLoading || !stats ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <div className="space-y-4">
                {stats.topAreas.slice(0, 4).map((a) => (
                  <div key={`${a.municipality}-${a.ward}`} className="flex items-center gap-4 rounded-xl border border-primary/5 p-3 hover:bg-primary/[0.02]">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-dashboard-orange/10 text-sm font-bold text-dashboard-orange">
                      {a.municipality.charAt(0).toUpperCase()}{a.ward}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-primary">{a.municipality}</p>
                      <p className="truncate text-[11px] text-primary/50">Ward {a.ward}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-primary">{a.count}</p>
                      <p className="text-[10px] font-semibold text-primary/40">Reports</p>
                    </div>
                  </div>
                ))}
                {stats.topAreas.length === 0 && (
                  <p className="text-center text-sm text-primary/50 py-8">No reports yet.</p>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>

      { }
      <div>
        <h3 className="mb-4 text-base font-extrabold text-primary">Pending Actions</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="relative overflow-hidden border-none bg-dashboard-orange/10 p-5 shadow-none transition hover:bg-dashboard-orange/20">
            <span className="absolute right-4 top-4 grid h-6 w-6 place-items-center rounded-full bg-dashboard-orange text-xs font-bold text-white">
              {dash?.counts?.pending ?? 0}
            </span>
            <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-dashboard-orange/20 text-dashboard-orange">
              <FaHourglassHalf />
            </div>
            <h4 className="text-sm font-bold text-dashboard-orange">New Reports</h4>
            <p className="mt-1 text-[11px] font-medium text-dashboard-orange/70">Awaiting initial verification and assignment.</p>
            <Link to="/admin/dashboard/reports?status=PENDING" className="mt-4 inline-block rounded-lg bg-dashboard-orange px-4 py-2 text-xs font-bold text-white">
              Review Now &rarr;
            </Link>
          </Card>

          <Card className="relative overflow-hidden border-none bg-dashboard-blue/10 p-5 shadow-none transition hover:bg-dashboard-blue/20">
            <span className="absolute right-4 top-4 grid h-6 w-6 place-items-center rounded-full bg-dashboard-blue text-xs font-bold text-white">
              {dash?.counts?.assigned ?? 0}
            </span>
            <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-dashboard-blue/20 text-dashboard-blue">
              <FaUserCog />
            </div>
            <h4 className="text-sm font-bold text-dashboard-blue">Worker Updates</h4>
            <p className="mt-1 text-[11px] font-medium text-dashboard-blue/70">Assigned reports awaiting worker progress updates.</p>
            <Link to="/admin/dashboard/reports?status=ASSIGNED" className="mt-4 inline-block rounded-lg bg-dashboard-blue px-4 py-2 text-xs font-bold text-white">
              Review Now &rarr;
            </Link>
          </Card>

          <Card className="relative overflow-hidden border-none bg-dashboard-red/10 p-5 shadow-none transition hover:bg-dashboard-red/20">
            <span className="absolute right-4 top-4 grid h-6 w-6 place-items-center rounded-full bg-dashboard-red text-xs font-bold text-white">
              {stats?.severity?.CRITICAL ?? 0}
            </span>
            <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-dashboard-red/20 text-dashboard-red">
              <FaBan />
            </div>
            <h4 className="text-sm font-bold text-dashboard-red">Critical Hazards</h4>
            <p className="mt-1 text-[11px] font-medium text-dashboard-red/70">Urgent reports marked as CRITICAL severity.</p>
            <Link to="/admin/dashboard/reports" className="mt-4 inline-block rounded-lg bg-dashboard-red px-4 py-2 text-xs font-bold text-white">
              View Issues &rarr;
            </Link>
          </Card>
        </div>
      </div>

    </motion.div>
  );
}
