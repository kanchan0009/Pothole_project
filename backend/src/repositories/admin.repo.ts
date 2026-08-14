import { Prisma, Severity, Status } from '@prisma/client';
import { SEVERITY_WEIGHT } from '../algorithms/priority.js';
import { prisma } from '../config/prisma.js';
import { reportRef } from '../utils/reportRef.js';

export type AnalyticsPeriod = 'day' | 'week' | 'month' | 'year';

export interface StatusCounts {
  total: number;
  pending: number;
  verified: number;
  assigned: number;
  inProgress: number;
  completed: number;
  rejected: number;
}

export interface HeatPoint {
  latitude: number;
  longitude: number;
  weight: number; 
  severity: Severity;
  status: Status;
}

export interface ReportExportRow {
  ref: string;
  title: string;
  status: Status;
  severity: Severity;
  roadName: string;
  municipality: string;
  ward: string;
  priorityScore: number;
  reporterName: string | null;
  createdAt: Date;
  updatedAt: Date;
}


export const adminRepo = {
  
  async statusCounts(): Promise<StatusCounts> {
    const [total, byStatus] = await Promise.all([
      prisma.report.count(),
      prisma.report.groupBy({ by: ['status'], _count: { status: true } }),
    ]);
    const pick = (s: Status): number => byStatus.find((r) => r.status === s)?._count.status ?? 0;
    return {
      total,
      pending: pick(Status.PENDING),
      verified: pick(Status.VERIFIED),
      assigned: pick(Status.ASSIGNED),
      inProgress: pick(Status.IN_PROGRESS),
      completed: pick(Status.COMPLETED),
      rejected: pick(Status.REJECTED),
    };
  },

  
  countsBetween(from: Date, to?: Date) {
    return prisma.report.count({
      where: { createdAt: { gte: from, lte: to ?? undefined } },
    });
  },

  
  async averageResolutionHours(): Promise<number | null> {
    const completed = await prisma.report.findMany({
      where: { status: Status.COMPLETED },
      select: { id: true, createdAt: true },
    });
    if (completed.length === 0) return null;

    const completions = await prisma.statusHistory.findMany({
      where: { status: Status.COMPLETED, reportId: { in: completed.map((r) => r.id) } },
      select: { reportId: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    const doneAt = new Map<number, number>();
    for (const h of completions) {
      if (!doneAt.has(h.reportId)) doneAt.set(h.reportId, h.createdAt.getTime());
    }

    const hours: number[] = [];
    for (const r of completed) {
      const done = doneAt.get(r.id);
      if (done != null) hours.push((done - r.createdAt.getTime()) / 3_600_000);
    }
    if (hours.length === 0) return null;
    return Math.round((hours.reduce((a, b) => a + b, 0) / hours.length) * 100) / 100;
  },

  
  async timeSeries(period: AnalyticsPeriod, from?: Date, to?: Date) {
    const end = to ?? new Date();
    const start = from ?? windowStart(period, end);
    const rows = await prisma.report.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { createdAt: true },
    });
    return bucketize(
      rows.map((r) => r.createdAt.getTime()),
      period,
      start,
      end
    );
  },

  severityDistribution() {
    return prisma.report.groupBy({ by: ['severity'], _count: { severity: true } });
  },

  
  async topActiveUsers(limit = 8): Promise<{ userId: number; name: string; count: number }[]> {
    const rows = await prisma.report.groupBy({
      by: ['userId'],
      _count: { userId: true },
      orderBy: { userId: 'desc' },
    });
    const top = rows
      .map((r) => ({ userId: r.userId, count: r._count.userId }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
    if (top.length === 0) return [];

    const users = await prisma.user.findMany({
      where: { id: { in: top.map((r) => r.userId) } },
      select: { id: true, name: true },
    });
    const nameById = new Map(users.map((u) => [u.id, u.name]));
    return top.map((r) => ({ userId: r.userId, name: nameById.get(r.userId) ?? 'Unknown', count: r.count }));
  },

  
  async aiAccuracy(): Promise<number | null> {
    const [total, confirmed] = await Promise.all([
      prisma.report.count({ where: { aiVerified: { not: null } } }),
      prisma.report.count({ where: { aiVerified: true } }),
    ]);
    if (total === 0) return null;
    return Math.round((confirmed / total) * 10_000) / 100;
  },

  
  topRoads(limit = 10) {
    return prisma.report.groupBy({
      by: ['roadName'],
      _count: { roadName: true },
      orderBy: { roadName: 'desc' },
    }).then((rows) =>
      rows
        .map((r) => ({ roadName: r.roadName, count: r._count.roadName }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit)
    );
  },

  
  topAreas(limit = 10) {
    return prisma.report.groupBy({
      by: ['municipality', 'ward'],
      _count: { ward: true },
    }).then((rows) =>
      rows
        .map((r) => ({ municipality: r.municipality, ward: r.ward, count: r._count.ward }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit)
    );
  },

  
  async heatmap(): Promise<HeatPoint[]> {
    const rows = await prisma.report.findMany({
      where: { latitude: { not: null }, longitude: { not: null } },
      select: { latitude: true, longitude: true, severity: true, status: true },
    });
    return rows
      .filter((r): r is typeof r & { latitude: number; longitude: number } =>
        r.latitude != null && r.longitude != null
      )
      .map((r) => ({
        latitude: r.latitude,
        longitude: r.longitude,
        weight: (SEVERITY_WEIGHT[r.severity] ?? 0) + 1,
        severity: r.severity,
        status: r.status,
      }));
  },

  
  async exportRows(filters: {
    status?: Status;
    severity?: Severity;
    municipality?: string;
    ward?: string;
    search?: string;
    from?: Date;
    to?: Date;
  }): Promise<ReportExportRow[]> {
    const where: Prisma.ReportWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.severity) where.severity = filters.severity;
    if (filters.municipality) where.municipality = { contains: filters.municipality };
    if (filters.ward) where.ward = { contains: filters.ward };
    if (filters.from || filters.to) where.createdAt = { gte: filters.from, lte: filters.to };
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search } },
        { description: { contains: filters.search } },
        { roadName: { contains: filters.search } },
        { municipality: { contains: filters.search } },
      ];
    }

    const rows = await prisma.report.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true } } },
    });
    return rows.map((r) => ({
      ref: reportRef(r.id),
      title: r.title,
      status: r.status,
      severity: r.severity,
      roadName: r.roadName,
      municipality: r.municipality,
      ward: r.ward,
      priorityScore: r.priorityScore,
      reporterName: r.user?.name ?? null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  },

  
  recentLogs(limit = 10) {
    return prisma.adminLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { admin: { select: { name: true } } },
    });
  },

  logAction(adminId: number, action: string, details?: string) {
    return prisma.adminLog.create({ data: { adminId, action, details } });
  },
};






function windowStart(period: AnalyticsPeriod, end: Date): Date {
  const d = new Date(end);
  switch (period) {
    case 'day':
      d.setDate(d.getDate() - 29); 
      break;
    case 'week':
      d.setDate(d.getDate() - 77); 
      break;
    case 'month':
      d.setMonth(d.getMonth() - 11); 
      break;
    case 'year':
      d.setFullYear(d.getFullYear() - 4); 
      break;
  }
  return bucketStart(period, d);
}

function bucketStart(period: AnalyticsPeriod, d: Date): Date {
  if (period === 'day') return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (period === 'week') {
    const day = (d.getDay() + 6) % 7; 
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
  }
  if (period === 'month') return new Date(d.getFullYear(), d.getMonth(), 1);
  return new Date(d.getFullYear(), 0, 1);
}

function nextBucket(period: AnalyticsPeriod, start: Date): Date {
  if (period === 'day') return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
  if (period === 'week') return new Date(start.getTime() + 7 * 86_400_000);
  if (period === 'month') return new Date(start.getFullYear(), start.getMonth() + 1, 1);
  return new Date(start.getFullYear() + 1, 0, 1);
}

function bucketLabel(period: AnalyticsPeriod, start: Date): string {
  if (period === 'day') return start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (period === 'week') return `Wk ${isoWeekNumber(start)}`;
  if (period === 'month') return start.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  return String(start.getFullYear());
}

function bucketize(
  times: number[],
  period: AnalyticsPeriod,
  start: Date,
  end: Date
): { label: string; count: number }[] {
  const buckets = new Map<string, { label: string; count: number }>();
  const stop = end.getTime();
  const cursor = new Date(bucketStart(period, start));

  
  while (cursor.getTime() <= stop) {
    buckets.set(cursor.toISOString(), { label: bucketLabel(period, cursor), count: 0 });
    const next = bucketStart(period, nextBucket(period, cursor)); 
    if (next.getTime() <= cursor.getTime()) break; 
    cursor.setTime(next.getTime());
  }

  for (const t of times) {
    const bucket = buckets.get(bucketStart(period, new Date(t)).toISOString());
    if (bucket) bucket.count += 1;
  }

  return [...buckets.values()];
}


function isoWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}
