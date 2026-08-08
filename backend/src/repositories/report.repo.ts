import { Prisma, Severity, Status, type Report } from "@prisma/client";
import { boundingBox, haversineDistance } from "../algorithms/geo.js";
import { OPEN_STATUSES } from "../algorithms/duplicate.js";
import { prisma } from "../config/prisma.js";
import type { StatusCounts } from "./admin.repo.js";

export interface ReportFilters {
  status?: Status;
  severity?: Severity;
  municipality?: string;
  ward?: string;
  roadName?: string;
  search?: string;
  reporter?: string;
  userId?: number;
  from?: Date;
  to?: Date;
}

export type ReportSortKey =
  | "newest"
  | "oldest"
  | "priority"
  | "severity"
  | "status";

export interface NearbyOpenReport {
  id: number;
  title: string;
  imageUrl: string;
  status: Status;
  severity: Severity;
  latitude: number;
  longitude: number;
  createdAt: Date;
  distance: number;
}

/** Data access for reports — the only place that touches the reports table family. */
export const reportRepo = {
  /** Creates a report + its PENDING status-history entry + location row in one transaction. */
  async create(input: {
    userId: number;
    title: string;
    description: string;
    imageUrl: string;
    imageHash?: string | null;
    roadName: string;
    municipality: string;
    ward: string;
    landmark?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    severity: Severity;
    duplicate: boolean;
    priorityScore: number;
    confidenceScore?: number | null;
    boundingBox?: string | null;
    detectedImageUrl?: string | null;
    aiSeverity?: Severity | null;
    aiClassProbs?: string | null;
    suggestedSeverity?: Severity | null;
  }): Promise<Report> {
    return prisma.$transaction(async (tx) => {
      const report = await tx.report.create({
        data: { ...input, status: Status.PENDING },
      });
      await tx.statusHistory.create({
        data: { reportId: report.id, status: Status.PENDING },
      });
      if (input.latitude != null && input.longitude != null) {
        await tx.location.create({
          data: {
            reportId: report.id,
            latitude: input.latitude,
            longitude: input.longitude,
            municipality: input.municipality,
            ward: input.ward,
            roadName: input.roadName,
            landmark: input.landmark,
          },
        });
      }
      return report;
    });
  },

  findById(id: number, include?: Prisma.ReportInclude) {
    return prisma.report.findUnique({ where: { id }, include });
  },

  async findMany(params: {
    filters: ReportFilters;
    orderBy:
      | Prisma.ReportOrderByWithRelationInput
      | Prisma.ReportOrderByWithRelationInput[];
    page: number;
    limit: number;
  }) {
    const where = buildWhere(params.filters);
    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        orderBy: params.orderBy,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        include: { user: { select: { id: true, name: true } } },
      }),
      prisma.report.count({ where }),
    ]);
    return { reports, total };
  },

  update(id: number, data: Prisma.ReportUpdateInput) {
    return prisma.report.update({ where: { id }, data });
  },

  remove(id: number) {
    return prisma.report.delete({ where: { id } });
  },

  getTimeline(reportId: number) {
    return prisma.statusHistory.findMany({
      where: { reportId },
      orderBy: { createdAt: "asc" },
      include: { updatedBy: { select: { name: true } } },
    });
  },

  /** Per-status counts for one citizen's reports — powers the dashboard summary cards. */
  async statusCountsForUser(userId: number): Promise<StatusCounts> {
    const where = { userId, userHidden: false };
    const [total, byStatus] = await Promise.all([
      prisma.report.count({ where }),
      prisma.report.groupBy({
        by: ["status"],
        where,
        _count: { status: true },
      }),
    ]);
    const pick = (s: Status): number =>
      byStatus.find((r) => r.status === s)?._count.status ?? 0;
    const removed = pick(Status.REMOVED);
    return {
      total,
      pending: pick(Status.PENDING),
      verified: pick(Status.VERIFIED),
      assigned: pick(Status.ASSIGNED),
      inProgress: pick(Status.IN_PROGRESS),
      completed: pick(Status.COMPLETED) + removed,
      rejected: pick(Status.REJECTED),
    };
  },

  /**
   * Finds open reports within `radiusM` of a point (bounding-box prefilter + Haversine),
   * sorted nearest-first. Used by duplicate detection.
   */
  async findOpenNear(
    lat: number,
    lng: number,
    radiusM: number,
  ): Promise<NearbyOpenReport[]> {
    const box = boundingBox(lat, lng, radiusM);
    const rows = await prisma.report.findMany({
      where: {
        status: { in: [...OPEN_STATUSES] as Status[] },
        latitude: { gte: box.minLat, lte: box.maxLat },
        longitude: { gte: box.minLng, lte: box.maxLng },
      },
      select: {
        id: true,
        title: true,
        imageUrl: true,
        status: true,
        severity: true,
        latitude: true,
        longitude: true,
        createdAt: true,
      },
    });

    return rows
      .filter(
        (
          r,
        ): r is (typeof rows)[number] & {
          latitude: number;
          longitude: number;
        } => r.latitude != null && r.longitude != null,
      )
      .map((r) => ({
        ...r,
        distance: haversineDistance(lat, lng, r.latitude, r.longitude),
      }))
      .filter((r) => r.distance <= radiusM)
      .sort((a, b) => a.distance - b.distance);
  },
};

function buildWhere(filters: ReportFilters): Prisma.ReportWhereInput {
  const where: Prisma.ReportWhereInput = {};
  if (filters.status) {
    if (filters.userId && filters.status === Status.COMPLETED) {
      where.status = { in: [Status.COMPLETED, Status.REMOVED] };
    } else {
      where.status = filters.status;
    }
  } else if (!filters.userId) {
    where.status = { not: Status.REMOVED };
  }
  if (filters.userId) {
    where.userId = filters.userId;
    where.userHidden = false;
  }
  if (filters.severity) where.severity = filters.severity;
  if (filters.municipality)
    where.municipality = { contains: filters.municipality };
  if (filters.ward) where.ward = { contains: filters.ward };
  if (filters.roadName) where.roadName = { contains: filters.roadName };
  if (filters.reporter) where.user = { name: { contains: filters.reporter } };
  if (filters.from || filters.to) {
    where.createdAt = { gte: filters.from, lte: filters.to };
  }
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search } },
      { description: { contains: filters.search } },
      { roadName: { contains: filters.search } },
      { municipality: { contains: filters.search } },
    ];
  }
  return where;
}
