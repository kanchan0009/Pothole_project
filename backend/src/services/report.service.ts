import { Prisma, Role, Severity, Status, type Report } from '@prisma/client';
import { DUPLICATE_RADIUS_M, OPEN_STATUSES } from '../algorithms/duplicate.js';
import type { DetectionBox } from '../algorithms/detector.js';
import { computeImageHash, hammingDistance, processImage, storeImage, validateImageFile } from '../algorithms/image.js';
import { SEVERITY_WEIGHT, computePriorityScore } from '../algorithms/priority.js';
import { prisma } from '../config/prisma.js';
import { detectionService } from './detection.service.js';
import { reportRepo, type NearbyOpenReport, type ReportFilters, type ReportSortKey } from '../repositories/report.repo.js';
import { ApiError } from '../utils/ApiError.js';
import { buildReceiptPdf } from '../utils/exporters.js';
import { reportRef } from '../utils/reportRef.js';

/** Report + relations the receipt needs (user name and the status timeline). */
type ReceiptReport = Prisma.ReportGetPayload<{
  include: {
    user: { select: { name: true } };
    history: { orderBy: { createdAt: 'asc' }; include: { updatedBy: { select: { name: true } } } };
  };
}>;

/** Status display order — used for the "status" list sort. */
const STATUS_ORDER: Status[] = [
  Status.PENDING,
  Status.VERIFIED,
  Status.ASSIGNED,
  Status.IN_PROGRESS,
  Status.COMPLETED,
  Status.REJECTED,
];

export interface NearbyReportDTO {
  id: number;
  title: string;
  distance: number; // meters
  imageUrl: string;
  status: Status;
  severity: Severity;
  createdAt: string;
}

/** Flat report row as returned to clients. */
export interface ReportListItem {
  id: number;
  userId: number;
  title: string;
  description: string;
  imageUrl: string;
  roadName: string;
  municipality: string;
  ward: string;
  landmark: string | null;
  latitude: number | null;
  longitude: number | null;
  severity: Severity;
  status: Status;
  duplicate: boolean;
  priorityScore: number;
  confidenceScore: number | null;
  boundingBox: DetectionBox | null;
  detectedImageUrl: string | null;
  aiVerified: boolean | null;
  aiRejectedReason: string | null;
  aiSeverity: Severity | null;
  aiClassProbs: number[] | null;
  suggestedSeverity: Severity | null;
  confirmations: number;
  completionImageUrl: string | null;
  rejectionReason: string | null;
  reporterName: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Report detail = list row + nested location/history/assignments. */
export interface ReportDetail extends ReportListItem {
  location?: unknown;
  history?: unknown[];
  assignments?: unknown[];
}

type CreateResult = { ok: true; report: ReportDetail } | { ok: false; reason: 'duplicate'; nearbyReport: NearbyReportDTO };

/**
 * Records a blocked duplicate attempt in the reporter's notification history,
 * so "Duplicate location / image" events persist alongside the in-session toast.
 */
async function notifyDuplicate(userId: number, message: string): Promise<void> {
  await prisma.notification.create({
    data: { userId, title: 'Duplicate report', message },
  });
}

export const reportService = {
  async create(
    userId: number,
    input: {
      title: string;
      description: string;
      roadName: string;
      municipality: string;
      ward: string;
      landmark?: string;
      latitude?: number;
      longitude?: number;
      severity: Severity;
    },
    file: Express.Multer.File | undefined,
    ignoreDuplicate: boolean,
    skipDetection = false
  ): Promise<CreateResult> {
    if (!file) {
      throw ApiError.badRequest('A photo of the hazard is required');
    }
    validateImageFile(file);

    // Process image first to validate content & calculate perceptual hash
    const processed = await processImage(file);
    const imageHash = await computeImageHash(processed);

    // Duplicate image check: reject if identical/similar image was uploaded for an open report
    if (imageHash) {
      const openReportsWithHash = await prisma.report.findMany({
        where: {
          status: { in: [...OPEN_STATUSES] as Status[] },
          imageHash: { not: null },
        },
        select: { id: true, imageHash: true },
      });
      for (const existing of openReportsWithHash) {
        if (existing.imageHash && hammingDistance(imageHash, existing.imageHash) <= 25) {
          await notifyDuplicate(userId, 'This pothole has already been reported by another user.');
          throw ApiError.conflict('This pothole has already been reported by another user.', 'DUPLICATE_IMAGE');
        }
      }
    }

    // Location duplicate detection: check GPS distance or address match
    let duplicate = false;
    let confirmedDuplicateId: number | undefined;
    if (input.latitude != null && input.longitude != null) {
      const near = await reportRepo.findOpenNear(input.latitude, input.longitude, DUPLICATE_RADIUS_M);
      const closest = near[0];
      if (closest) {
        const nearbyReport: NearbyReportDTO = {
          id: closest.id,
          title: closest.title,
          distance: Math.round(closest.distance * 10) / 10,
          imageUrl: closest.imageUrl,
          status: closest.status,
          severity: closest.severity,
          createdAt: closest.createdAt.toISOString(),
        };
        if (!ignoreDuplicate) {
          await notifyDuplicate(
            userId,
            'This pothole has already been reported. You can track the existing report instead of creating a duplicate.'
          );
          return { ok: false, reason: 'duplicate', nearbyReport };
        }
        duplicate = true;
        confirmedDuplicateId = closest.id;
      }
    }

    if (!duplicate && !confirmedDuplicateId) {
      const existingByAddress = await prisma.report.findFirst({
        where: {
          status: { in: [...OPEN_STATUSES] as Status[] },
          roadName: { equals: input.roadName },
          municipality: { equals: input.municipality },
          ward: { equals: input.ward },
        },
        select: { id: true, title: true, imageUrl: true, status: true, severity: true, createdAt: true },
      });
      if (existingByAddress) {
        const nearbyReport: NearbyReportDTO = {
          id: existingByAddress.id,
          title: existingByAddress.title,
          distance: 0,
          imageUrl: existingByAddress.imageUrl,
          status: existingByAddress.status,
          severity: existingByAddress.severity,
          createdAt: existingByAddress.createdAt.toISOString(),
        };
        if (!ignoreDuplicate) {
          await notifyDuplicate(
            userId,
            'This pothole has already been reported. You can track the existing report instead of creating a duplicate.'
          );
          return { ok: false, reason: 'duplicate', nearbyReport };
        }
        duplicate = true;
        confirmedDuplicateId = existingByAddress.id;
      }
    }

    let imageUrl: string;
    let detectedImageUrl: string | null = null;
    let confidenceScore: number | null = null;
    let boundingBox: string | null = null;
    let aiSeverity: Severity | undefined;
    let aiClassProbs: string | null = null;
    if (skipDetection) {
      imageUrl = await storeImage(processed);
    } else {
      const { result: detection, annotated } = await detectionService.analyze(processed);
      if (!detection.isPothole) {
        throw ApiError.badRequest(
          'No pothole detected in this image. Please upload another photo of the hazard.'
        );
      }
      imageUrl = await storeImage(processed);
      detectedImageUrl = annotated ? await storeImage(annotated) : null;
      confidenceScore = detection.confidence;
      boundingBox = detection.boundingBox ? JSON.stringify(detection.boundingBox) : null;
      aiSeverity = detection.severity;
      if (detection.classProbs) aiClassProbs = JSON.stringify(detection.classProbs);
    }
    const severity = aiSeverity ?? input.severity;
    const priorityScore = computePriorityScore(severity, 0, 0, 0);

    const report = await reportRepo.create({
      ...input,
      userId,
      imageUrl,
      imageHash,
      duplicate,
      severity,
      suggestedSeverity: input.severity,
      aiSeverity: aiSeverity ?? null,
      aiClassProbs,
      priorityScore,
      confidenceScore,
      boundingBox,
      detectedImageUrl,
    });

    if (confirmedDuplicateId !== undefined) {
      await bumpConfirmation(confirmedDuplicateId);
    }

    await prisma.notification.createMany({
      data: [
        {
          userId,
          title: 'Report submitted',
          message: `${reportRef(report.id)} is now PENDING review by the municipality.`,
        },
      ],
    });
    await notifyAdmins(
      'New report submitted',
      `${report.title} — ${report.municipality}, Ward ${report.ward}`
    );

    const detail = await this.getReport(report.id);
    return { ok: true, report: detail };
  },

  async list(query: {
    page: number;
    limit: number;
    sort: ReportSortKey;
    filters: ReportFilters;
  }) {
    const { page, limit, sort, filters } = query;
    const orderBy: Prisma.ReportOrderByWithRelationInput | Prisma.ReportOrderByWithRelationInput[] =
      sort === 'oldest'
        ? { createdAt: 'asc' }
        : sort === 'priority'
          ? [{ priorityScore: 'desc' }, { createdAt: 'desc' }]
          : { createdAt: 'desc' };

    const { reports, total } = await reportRepo.findMany({ filters, orderBy, page, limit });
    let items = reports.map(toListItem);

    // Severity/status sort use weights (enum alphabetic order is meaningless).
    if (sort === 'severity') {
      items = [...items].sort((a, b) => SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity]);
    } else if (sort === 'status') {
      items = [...items].sort(
        (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
      );
    }

    return {
      reports: items,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  },

  /** Status counts scoped to one citizen — backs the dashboard summary cards. */
  async mineStats(userId: number) {
    return reportRepo.statusCountsForUser(userId);
  },

  async getReport(id: number): Promise<ReportDetail> {
    const report = await reportRepo.findById(id, {
      user: { select: { id: true, name: true } },
      location: true,
      history: {
        orderBy: { createdAt: 'asc' },
        include: { updatedBy: { select: { name: true } } },
      },
      assignments: true,
    });
    if (!report) {
      throw ApiError.notFound('Report not found');
    }
    return toDetail(report);
  },

  /**
   * Official PDF receipt for one report. Only the reporter or an admin may
   * download it; the citizen-facing FR-20 receipt embeds the stored before/after
   * photos and the authoritative status timeline from the database.
   */
  async getReceipt(actorId: number, role: Role, id: number): Promise<{ ref: string; pdf: Buffer }> {
    const report = (await reportRepo.findById(id, {
      user: { select: { name: true } },
      history: { orderBy: { createdAt: 'asc' }, include: { updatedBy: { select: { name: true } } } },
    })) as ReceiptReport | null;
    if (!report) {
      throw ApiError.notFound('Report not found');
    }
    if (role !== Role.ADMIN && report.userId !== actorId) {
      throw ApiError.forbidden('You can only download the receipt for your own reports');
    }

    const ref = reportRef(report.id);
    const pdf = await buildReceiptPdf({
      ref,
      title: report.title,
      description: report.description,
      status: report.status,
      severity: report.severity,
      roadName: report.roadName,
      municipality: report.municipality,
      ward: report.ward,
      landmark: report.landmark,
      latitude: report.latitude,
      longitude: report.longitude,
      reporterName: report.user?.name ?? null,
      duplicate: report.duplicate,
      priorityScore: report.priorityScore,
      imageUrl: report.imageUrl,
      completionImageUrl: report.completionImageUrl,
      rejectionReason: report.rejectionReason,
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString(),
      history: report.history.map((h) => ({
        status: h.status,
        remarks: h.remarks,
        updatedBy: h.updatedBy?.name ?? null,
        createdAt: h.createdAt.toISOString(),
      })),
    });
    return { ref, pdf };
  },

  async getTimeline(id: number) {
    const report = await reportRepo.findById(id);
    if (!report) {
      throw ApiError.notFound('Report not found');
    }
    const history = await reportRepo.getTimeline(id);
    return history.map((h) => ({
      id: h.id,
      reportId: h.reportId,
      status: h.status,
      remarks: h.remarks,
      updatedBy: h.updatedBy?.name ?? null,
      createdAt: h.createdAt.toISOString(),
    }));
  },

  async update(
    actorId: number,
    role: Role,
    id: number,
    input: {
      title?: string;
      description?: string;
      roadName?: string;
      municipality?: string;
      ward?: string;
      landmark?: string | null;
      latitude?: number;
      longitude?: number;
      severity?: Severity;
    },
    file?: Express.Multer.File
  ): Promise<ReportDetail> {
    const existing = await reportRepo.findById(id);
    if (!existing) {
      throw ApiError.notFound('Report not found');
    }
    if (role !== Role.ADMIN && existing.userId !== actorId) {
      throw ApiError.forbidden('You can only edit your own reports');
    }

    if (file) {
      validateImageFile(file);
    }

    const data: Record<string, unknown> = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined) data.description = input.description;
    if (input.roadName !== undefined) data.roadName = input.roadName;
    if (input.municipality !== undefined) data.municipality = input.municipality;
    if (input.ward !== undefined) data.ward = input.ward;
    if (input.landmark !== undefined) data.landmark = input.landmark;
    if (input.latitude !== undefined) data.latitude = input.latitude;
    if (input.longitude !== undefined) data.longitude = input.longitude;
    if (input.severity !== undefined) data.severity = input.severity;
    if (file) data.imageUrl = await processAndStore(file);

    if (Object.keys(data).length === 0) {
      throw ApiError.badRequest('Nothing to update');
    }

    await reportRepo.update(id, data);

    // Keep the normalized Location row in sync when coordinates change.
    if (input.latitude != null && input.longitude != null) {
      const location = await prisma.location.findUnique({ where: { reportId: id } });
      const locData = {
        latitude: input.latitude,
        longitude: input.longitude,
        municipality: input.municipality ?? existing.municipality,
        ward: input.ward ?? existing.ward,
        roadName: input.roadName ?? existing.roadName,
        landmark: input.landmark !== undefined ? input.landmark : existing.landmark,
      };
      if (location) {
        await prisma.location.update({ where: { reportId: id }, data: locData });
      } else {
        await prisma.location.create({ data: { reportId: id, ...locData } });
      }
    }

    return this.getReport(id);
  },

  async remove(id: number): Promise<void> {
    const existing = await reportRepo.findById(id);
    if (!existing) {
      throw ApiError.notFound('Report not found');
    }
    await reportRepo.remove(id);
  },

  async removeForUser(userId: number, id: number): Promise<void> {
    const existing = await reportRepo.findById(id);
    if (!existing || existing.userId !== userId) {
      throw ApiError.notFound('Report not found');
    }
    if (existing.status !== Status.COMPLETED) {
      throw ApiError.badRequest('Only completed reports can be removed from your dashboard');
    }
    await prisma.report.update({
      where: { id },
      data: { userHidden: true },
    });
    await prisma.notification.create({
      data: {
        userId,
        title: 'Report removed',
        message: 'The completed report has been removed from your dashboard.',
      },
    });
  },

  async checkDuplicate(latitude: number, longitude: number): Promise<{ duplicate: boolean; nearbyReport?: NearbyReportDTO }> {
    const near = await reportRepo.findOpenNear(latitude, longitude, DUPLICATE_RADIUS_M);
    const closest = near[0];
    if (!closest) {
      return { duplicate: false };
    }
    return {
      duplicate: true,
      nearbyReport: {
        id: closest.id,
        title: closest.title,
        distance: Math.round(closest.distance * 10) / 10,
        imageUrl: closest.imageUrl,
        status: closest.status,
        severity: closest.severity,
        createdAt: closest.createdAt.toISOString(),
      },
    };
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function processAndStore(file: Express.Multer.File): Promise<string> {
  const buffer = await processImage(file);
  return storeImage(buffer);
}

async function notifyAdmins(title: string, message: string): Promise<void> {
  const admins = await prisma.user.findMany({ where: { role: Role.ADMIN }, select: { id: true } });
  if (admins.length === 0) return;
  await prisma.notification.createMany({
    data: admins.map((a) => ({ userId: a.id, title, message })),
  });
}

function toListItem(report: Report & { user?: { id: number; name: string } | null }): ReportListItem {
  return {
    id: report.id,
    userId: report.userId,
    title: report.title,
    description: report.description,
    imageUrl: report.imageUrl,
    roadName: report.roadName,
    municipality: report.municipality,
    ward: report.ward,
    landmark: report.landmark,
    latitude: report.latitude,
    longitude: report.longitude,
    severity: report.severity,
    status: report.status,
    duplicate: report.duplicate,
    priorityScore: report.priorityScore,
    confidenceScore: report.confidenceScore,
    boundingBox: report.boundingBox ? (JSON.parse(report.boundingBox) as DetectionBox) : null,
    detectedImageUrl: report.detectedImageUrl,
    aiVerified: report.aiVerified,
    aiRejectedReason: report.aiRejectedReason,
    aiSeverity: report.aiSeverity,
    aiClassProbs: report.aiClassProbs ? (JSON.parse(report.aiClassProbs) as number[]) : null,
    suggestedSeverity: report.suggestedSeverity,
    confirmations: report.confirmations,
    completionImageUrl: report.completionImageUrl,
    rejectionReason: report.rejectionReason,
    reporterName: report.user?.name ?? null,
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
  };
}

function toDetail(
  report: Report & { user?: { id: number; name: string } | null } & {
    location?: unknown;
    history?: unknown[];
    assignments?: unknown[];
  }
): ReportDetail {
  return {
    ...toListItem(report),
    location: report.location,
    history: report.history,
    assignments: report.assignments,
  };
}

const DAY_MS = 86_400_000;

/** A citizen confirmed an existing report — +1 confirmation, priority recomputed. */
async function bumpConfirmation(reportId: number): Promise<void> {
  const report = await prisma.report.findUniqueOrThrow({ where: { id: reportId } });
  const confirmations = report.confirmations + 1;
  const ageDays = Math.max(0, (Date.now() - report.createdAt.getTime()) / DAY_MS);
  const priorityScore = computePriorityScore(report.severity, confirmations, ageDays, 0);
  await prisma.report.update({
    where: { id: reportId },
    data: { confirmations, priorityScore },
  });
}
