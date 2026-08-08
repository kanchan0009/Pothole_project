import { Prisma, Role, Status, type Report } from '@prisma/client';
import { haversineDistance } from '../algorithms/geo.js';
import { processImage, storeImage, validateImageFile } from '../algorithms/image.js';
import { computePriorityScore } from '../algorithms/priority.js';
import { prisma } from '../config/prisma.js';
import { adminRepo, type AnalyticsPeriod } from '../repositories/admin.repo.js';
import { reportRepo } from '../repositories/report.repo.js';
import { userRepo } from '../repositories/user.repo.js';
import { ApiError } from '../utils/ApiError.js';
import { reportRef } from '../utils/reportRef.js';
import { toPublicUser } from './auth.service.js';
import { notificationService } from './notification.service.js';
import { priorityQueueService } from './priorityQueue.service.js';
import { reportService } from './report.service.js';
import { routingService } from './routing.service.js';

/**
 * Report workflow. Only these forward moves are legal; REJECTED is reachable
 * from any open state and is terminal. This enforces the spec's
 * PENDING → VERIFIED → ASSIGNED → IN_PROGRESS → COMPLETED chain.
 */
const ALLOWED_NEXT: Record<Status, Status[]> = {
  PENDING: [Status.VERIFIED, Status.ASSIGNED, Status.REJECTED],
  VERIFIED: [Status.ASSIGNED, Status.IN_PROGRESS, Status.REJECTED],
  ASSIGNED: [Status.IN_PROGRESS, Status.COMPLETED, Status.REJECTED],
  IN_PROGRESS: [Status.COMPLETED, Status.REJECTED],
  COMPLETED: [Status.REMOVED],
  REJECTED: [],
  REMOVED: [],
};

interface WorkerRef {
  id: number;
  name: string;
}

export const adminService = {
  // -------------------------------------------------------------------------
  // Dashboard
  // -------------------------------------------------------------------------

  async dashboard(adminId: number) {
    const [counts, today, monthly, avgResolutionHours, recent, logs, notifications] = await Promise.all([
      adminRepo.statusCounts(),
      adminRepo.countsBetween(startOfDay(new Date())),
      adminRepo.countsBetween(startOfMonth(new Date())),
      adminRepo.averageResolutionHours(),
      reportService.list({ page: 1, limit: 5, sort: 'newest', filters: {} }),
      adminRepo.recentLogs(5),
      notificationService.listForUser(adminId),
    ]);

    return {
      counts,
      today,
      monthly,
      avgResolutionHours,
      recentReports: recent.reports,
      recentActivity: logs.map((l) => ({
        id: l.id,
        adminName: l.admin.name,
        action: l.action,
        details: l.details,
        createdAt: l.createdAt.toISOString(),
      })),
      notifications,
    };
  },

  // -------------------------------------------------------------------------
  // Analytics
  // -------------------------------------------------------------------------

  async statistics(period: AnalyticsPeriod, from?: Date, to?: Date) {
    const [timeSeries, severityDist, counts, topRoads, topAreas, heatmap, avgResolutionHours, aiAccuracy, topUsers] =
      await Promise.all([
        adminRepo.timeSeries(period, from, to),
        adminRepo.severityDistribution(),
        adminRepo.statusCounts(),
        adminRepo.topRoads(10),
        adminRepo.topAreas(10),
        adminRepo.heatmap(),
        adminRepo.averageResolutionHours(),
        adminRepo.aiAccuracy(),
        adminRepo.topActiveUsers(8),
      ]);

    const severity: Record<string, number> = {};
    for (const s of severityDist) severity[s.severity] = s._count.severity;

    return {
      period,
      total: counts.total,
      status: counts,
      severity,
      timeSeries,
      topRoads,
      topAreas,
      completionRate: counts.total ? Math.round((counts.completed / counts.total) * 10_000) / 100 : 0,
      avgResolutionHours,
      aiAccuracy,
      topUsers,
      heatmap: heatmap.map((h) => [h.latitude, h.longitude, h.weight] as [number, number, number]),
    };
  },

  // -------------------------------------------------------------------------
  // Report workflow
  // -------------------------------------------------------------------------

  /** Applies a legal status transition with all its side effects in one transaction. */
  async transitionStatus(
    adminId: number,
    reportId: number,
    input: { status: Status; remarks?: string; workerId?: number; assignedTo?: string },
    file?: Express.Multer.File
  ) {
    const report = await reportRepo.findById(reportId);
    if (!report) {
      throw ApiError.notFound('Report not found');
    }
    if (input.status === report.status) {
      throw ApiError.badRequest(`Report is already ${report.status}`);
    }
    if (!ALLOWED_NEXT[report.status].includes(input.status)) {
      throw ApiError.badRequest(`Invalid transition: ${report.status} → ${input.status}`);
    }
    if (input.status === Status.REJECTED && !input.remarks) {
      throw ApiError.badRequest('A rejection reason is required');
    }

    // Completion image — only meaningful (and processed) when completing.
    let completionImageUrl: string | undefined;
    if (input.status === Status.COMPLETED && file) {
      validateImageFile(file);
      completionImageUrl = await processAndStore(file);
    }

    // Assignment resolution happens before the transaction so failures abort cleanly.
    let assignment: { userId: number | null; assignedTo: string } | undefined;
    if (input.status === Status.ASSIGNED) {
      assignment = await resolveAssignment(report, input);
    }

    const priorityScore = computePriorityScore(
      report.severity,
      report.confirmations,
      ageDays(report.createdAt),
      0
    );

    await prisma.$transaction(async (tx) => {
      await tx.statusHistory.create({
        data: { reportId, status: input.status, remarks: input.remarks, updatedById: adminId },
      });
      await tx.report.update({
        where: { id: reportId },
        data: {
          status: input.status,
          priorityScore,
          ...(input.status === Status.REJECTED ? { rejectionReason: input.remarks } : {}),
          ...(completionImageUrl ? { completionImageUrl } : {}),
        },
      });
      if (assignment) {
        await upsertAssignment(tx, reportId, assignment);
      }
      await tx.adminLog.create({
        data: {
          adminId,
          action: 'STATUS_CHANGE',
          details: `${reportRef(reportId)} ${report.status} → ${input.status}` +
            (input.remarks ? ` — ${input.remarks}` : ''),
        },
      });
    });

    await notifyOwner(report, input.status, input.remarks);
    if (assignment?.userId) {
      await notify(assignment.userId, 'New assignment', `${reportRef(reportId)} ${report.title} has been assigned to you.`);
    }

    return reportService.getReport(reportId);
  },

  /** Assigns a worker (explicit or nearest-available) and moves the report to ASSIGNED. */
  async assignWorker(
    adminId: number,
    reportId: number,
    input: { workerId?: number; assignedTo?: string }
  ) {
    const report = await reportRepo.findById(reportId);
    if (!report) {
      throw ApiError.notFound('Report not found');
    }
    if (report.status === Status.COMPLETED || report.status === Status.REJECTED) {
      throw ApiError.badRequest('Cannot assign a closed report');
    }

    const assignment = await resolveAssignment(report, input);

    await prisma.$transaction(async (tx) => {
      await upsertAssignment(tx, reportId, assignment);
      if (report.status !== Status.ASSIGNED) {
        await tx.statusHistory.create({
          data: {
            reportId,
            status: Status.ASSIGNED,
            remarks: 'Assigned to maintenance crew',
            updatedById: adminId,
          },
        });
        await tx.report.update({ where: { id: reportId }, data: { status: Status.ASSIGNED } });
      }
      await tx.adminLog.create({
        data: { adminId, action: 'ASSIGN', details: `${reportRef(reportId)} → ${assignment.assignedTo}` },
      });
    });

    if (assignment.userId) {
      await notify(assignment.userId, 'New assignment', `${reportRef(reportId)} ${report.title} has been assigned to you.`);
    }
    await notifyOwner(report, Status.ASSIGNED);

    return reportService.getReport(reportId);
  },

  // -------------------------------------------------------------------------
  // Verify-AI
  // -------------------------------------------------------------------------

  /**
   * Admin verdict on the AI detection. Approving just records the verdict;
   * rejecting also rejects the report with the chosen reason (the AI is wrong
   * about it) so the citizen is told why via the normal notification flow.
   */
  async verifyAi(
    adminId: number,
    reportId: number,
    input: { approved: boolean; reason?: string }
  ) {
    const report = await reportRepo.findById(reportId);
    if (!report) {
      throw ApiError.notFound('Report not found');
    }
    if (report.confidenceScore == null) {
      throw ApiError.badRequest('This report has no AI detection to review');
    }
    if (report.aiVerified !== null) {
      throw ApiError.badRequest('This detection has already been reviewed');
    }
    if (report.status === Status.COMPLETED || report.status === Status.REJECTED) {
      throw ApiError.badRequest('This report is already closed');
    }

    if (input.approved) {
      await reportRepo.update(reportId, { aiVerified: true });
      await adminRepo.logAction(adminId, 'AI_VERIFY', `${reportRef(reportId)} detection confirmed`);
      return reportService.getReport(reportId);
    }

    const reason = AI_REASON_LABEL[input.reason ?? 'NOT_A_POTHOLY'] ?? 'Not a pothole';
    await reportRepo.update(reportId, { aiVerified: false, aiRejectedReason: reason });
    return this.transitionStatus(adminId, reportId, { status: Status.REJECTED, remarks: reason });
  },

  // -------------------------------------------------------------------------
  // Priority queue (max heap) + road routing
  // -------------------------------------------------------------------------

  /** The max-heap priority queue, ordered — highest priority first. */
  async priorityQueue() {
    return priorityQueueService.snapshot();
  },

  /** Pops the highest-priority report, assigns the nearest crew, returns it. */
  async dispatchNext(adminId: number) {
    return priorityQueueService.processNext(adminId);
  },

  /** Dijkstra route from the crew to a report (recomputed on every call). */
  async reportRoute(reportId: number) {
    return routingService.routeToReport(reportId);
  },

  // -------------------------------------------------------------------------
  // Users
  // -------------------------------------------------------------------------

  async listUsers(input: { page: number; limit: number; search?: string; role?: Role; active?: boolean; isWorker?: boolean }) {
    const { users, total } = await userRepo.list({
      where: {
        role: input.role,
        isActive: input.active,
        isWorker: input.isWorker,
        search: input.search,
      },
      page: input.page,
      limit: input.limit,
    });
    return {
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        isWorker: u.isWorker,
        isActive: u.isActive,
        // Coordinates let admins move a crew and recalc the Dijkstra route.
        latitude: u.latitude,
        longitude: u.longitude,
        reportCount: u._count.reports,
        createdAt: u.createdAt.toISOString(),
      })),
      pagination: { page: input.page, limit: input.limit, total, totalPages: Math.max(1, Math.ceil(total / input.limit)) },
    };
  },

  async updateUser(
    adminId: number,
    userId: number,
    input: { role?: Role; isActive?: boolean; isWorker?: boolean; latitude?: number; longitude?: number }
  ) {
    const target = await userRepo.findById(userId);
    if (!target) {
      throw ApiError.notFound('User not found');
    }

    // Guard rails: an admin can never lock themselves out or demote themselves.
    if (target.id === adminId && (input.role === Role.USER || input.isActive === false)) {
      throw ApiError.badRequest('You cannot demote or deactivate your own account');
    }
    // Never deactivate the last remaining active admin.
    if (target.role === Role.ADMIN && input.isActive === false) {
      const activeAdmins = await prisma.user.count({ where: { role: Role.ADMIN, isActive: true } });
      if (activeAdmins <= 1) {
        throw ApiError.badRequest('Cannot deactivate the last active administrator');
      }
    }

    const updated = await userRepo.update(userId, {
      role: input.role,
      isActive: input.isActive,
      isWorker: input.isWorker,
      latitude: input.latitude,
      longitude: input.longitude,
    });
    await adminRepo.logAction(adminId, 'USER_UPDATE', `Updated ${updated.email}: ${JSON.stringify(input)}`);

    return toPublicUser(updated);
  },

  async listWorkers() {
    const workers = await userRepo.findWorkers();
    return workers.map((w) => ({
      id: w.id,
      name: w.name,
      phone: w.phone,
      latitude: w.latitude,
      longitude: w.longitude,
    }));
  },

  // -------------------------------------------------------------------------
  // Audit trail
  // -------------------------------------------------------------------------

  async logs(limit = 20) {
    const logs = await adminRepo.recentLogs(Math.min(limit, 100));
    return logs.map((l) => ({
      id: l.id,
      adminName: l.admin.name,
      action: l.action,
      details: l.details,
      createdAt: l.createdAt.toISOString(),
    }));
  },

  // -------------------------------------------------------------------------
  // Exports
  // -------------------------------------------------------------------------

  async exportReports(filters: Parameters<typeof adminRepo.exportRows>[0]) {
    return adminRepo.exportRows(filters);
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function processAndStore(file: Express.Multer.File): Promise<string> {
  const buffer = await processImage(file);
  return storeImage(buffer);
}

function ageDays(createdAt: Date): number {
  return Math.max(0, (Date.now() - createdAt.getTime()) / 86_400_000);
}

/** Nearest active worker to the report (Haversine). Null when the report has no coordinates. */
async function nearestWorker(report: Report): Promise<WorkerRef | null> {
  if (report.latitude == null || report.longitude == null) return null;
  const workers = await userRepo.findWorkers();
  let best: WorkerRef | null = null;
  let bestDistance = Infinity;
  for (const w of workers) {
    if (w.latitude == null || w.longitude == null) continue;
    const d = haversineDistance(report.latitude, report.longitude, w.latitude, w.longitude);
    if (d < bestDistance) {
      bestDistance = d;
      best = { id: w.id, name: w.name };
    }
  }
  return best;
}

async function resolveAssignment(
  report: Report,
  input: { workerId?: number; assignedTo?: string }
): Promise<{ userId: number | null; assignedTo: string }> {
  if (input.workerId) {
    const worker = await userRepo.findById(input.workerId);
    if (!worker || !worker.isWorker || !worker.isActive) {
      throw ApiError.badRequest('Selected worker does not exist or is not available');
    }
    return { userId: worker.id, assignedTo: worker.name };
  }
  if (input.assignedTo) {
    return { userId: null, assignedTo: input.assignedTo };
  }
  const nearest = await nearestWorker(report);
  if (!nearest) {
    throw ApiError.badRequest('No workers available — assign a worker manually');
  }
  return { userId: nearest.id, assignedTo: nearest.name };
}

async function upsertAssignment(
  tx: Prisma.TransactionClient,
  reportId: number,
  assignment: { userId: number | null; assignedTo: string }
): Promise<void> {
  const existing = await tx.assignment.findFirst({ where: { reportId } });
  if (existing) {
    await tx.assignment.update({
      where: { id: existing.id },
      data: { userId: assignment.userId, assignedTo: assignment.assignedTo, assignedAt: new Date() },
    });
  } else {
    await tx.assignment.create({
      data: { reportId, userId: assignment.userId, assignedTo: assignment.assignedTo },
    });
  }
}

function notify(userId: number, title: string, message: string) {
  return prisma.notification.create({ data: { userId, title, message } });
}

async function notifyOwner(report: Report, status: Status, remarks?: string): Promise<void> {
  const ref = reportRef(report.id);
  const messages: Partial<Record<Status, [string, string]>> = {
    VERIFIED: ['Report verified', `${ref} ${report.title} has been verified by the municipality.`],
    ASSIGNED: ['Report assigned', `${ref} ${report.title} has been assigned to a maintenance crew.`],
    IN_PROGRESS: ['Work started', `${ref} ${report.title} is now being repaired.`],
    COMPLETED: ['Report completed', `${ref} ${report.title} has been completed. Thanks for reporting!`],
    REJECTED: ['Report rejected', `${ref} ${report.title} was rejected. Reason: ${remarks ?? 'Not specified'}.`],
    REMOVED: ['Report removed', `${ref} ${report.title} has been removed.`],
  };
  const entry = messages[status];
  if (!entry) return;
  await prisma.notification.create({ data: { userId: report.userId, title: entry[0], message: entry[1] } });
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Maps AI-rejection keys to the user-facing labels stored on the report. */
const AI_REASON_LABEL: Record<string, string> = {
  NOT_A_POTHOLY: 'Not a pothole',
  DUPLICATE: 'Duplicate report',
  BLURRED_IMAGE: 'Blurred image',
  FAKE_REPORT: 'Fake report',
};
