/**
 * The Max Heap priority queue, served to the admin console.
 *
 * Every open report (PENDING/VERIFIED/ASSIGNED/IN_PROGRESS) is loaded and
 * heapified by its `priorityScore` (severity + confirmations + age + traffic,
 * see `algorithms/priority.ts`). `snapshot` returns the heap in priority order
 * with the current peak; `processNext` pops the peak and dispatches it — the
 * top-priority pothole is always worked first.
 *
 * The heap is rebuilt on demand (O(n) heapify on a small set), so it always
 * reflects the latest mutations: a new report, a duplicate confirmation
 * (`confirmations++` bumps the original's score), and every status transition
 * recompute `priorityScore` before the next snapshot.
 */
import type { Severity, Status } from '@prisma/client';
import { OPEN_STATUSES } from '../algorithms/duplicate.js';
import { BinaryHeap } from '../algorithms/heap.js';
import { prisma } from '../config/prisma.js';
import { adminService } from './admin.service.js';
import { routingService } from './routing.service.js';
import { reportRef } from '../utils/reportRef.js';

const DAY_MS = 86_400_000;

interface OpenReportRow {
  id: number;
  title: string;
  severity: Severity;
  status: Status;
  priorityScore: number;
  confirmations: number;
  createdAt: Date;
  latitude: number | null;
  longitude: number | null;
  municipality: string;
  ward: string;
}

export interface PriorityQueueItem {
  rank: number;
  ref: string;
  id: number;
  title: string;
  severity: Severity;
  status: Status;
  priorityScore: number;
  confirmations: number;
  ageDays: number;
  municipality: string;
  ward: string;
  /** True when the report has coordinates (route / assignment possible). */
  hasCoords: boolean;
}

export interface QueueSnapshot {
  items: PriorityQueueItem[];
  size: number;
  /** The current maximum (next to be dispatched) — null when the queue is empty. */
  peek: PriorityQueueItem | null;
}

export const priorityQueueService = {
  /** All open reports (the heap's universe). */
  async loadOpenReports(): Promise<OpenReportRow[]> {
    return prisma.report.findMany({
      where: { status: { in: [...OPEN_STATUSES] as Status[] } },
      select: {
        id: true,
        title: true,
        severity: true,
        status: true,
        priorityScore: true,
        confirmations: true,
        createdAt: true,
        latitude: true,
        longitude: true,
        municipality: true,
        ward: true,
      },
    });
  },

  /**
   * Heapify the open reports into a max-heap by priority score.
   * Exposed separately so tests can exercise the heap directly.
   */
  buildHeap(rows: OpenReportRow[]): BinaryHeap<OpenReportRow> {
    return new BinaryHeap<OpenReportRow>((a, b) => b.priorityScore - a.priorityScore).buildFrom(rows);
  },

  /** Ordered queue view (root = highest priority) plus the peak. */
  async snapshot(): Promise<QueueSnapshot> {
    const heap = this.buildHeap(await this.loadOpenReports());
    const items: PriorityQueueItem[] = heap.toSortedArray().map((r, i) => ({
      rank: i + 1,
      ref: reportRef(r.id),
      id: r.id,
      title: r.title,
      severity: r.severity,
      status: r.status,
      priorityScore: r.priorityScore,
      confirmations: r.confirmations,
      ageDays: Math.round(Math.max(0, (Date.now() - r.createdAt.getTime()) / DAY_MS)),
      municipality: r.municipality,
      ward: r.ward,
      hasCoords: r.latitude != null && r.longitude != null,
    }));
    return { items, size: items.length, peek: items[0] ?? null };
  },

  /**
   * Dispatch the highest-priority report: pop the peak, resolve the nearest
   * team by road (Dijkstra), and move the report to ASSIGNED. Returns the
   * updated report and the road route that was planned.
   */
  async processNext(adminId: number) {
    const heap = this.buildHeap(await this.loadOpenReports());
    const top = heap.pop();
    if (!top) {
      return { processed: false, report: null, route: null };
    }

    const { route, team, teamSource } = await routingService.routeToReport(top.id);

    // Prefer the Dijkstra-nearest crew; fall back to the service's own
    // nearest-by-Haversine when no positioned team exists.
    const report = await adminService.assignWorker(
      adminId,
      top.id,
      team && teamSource === 'nearest' ? { workerId: team.id } : {}
    );

    return { processed: true, report, route, team, teamSource };
  },
};
