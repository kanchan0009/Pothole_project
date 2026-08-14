
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
  
  hasCoords: boolean;
}

export interface QueueSnapshot {
  items: PriorityQueueItem[];
  size: number;
  
  peek: PriorityQueueItem | null;
}

export const priorityQueueService = {
  
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

  
  buildHeap(rows: OpenReportRow[]): BinaryHeap<OpenReportRow> {
    return new BinaryHeap<OpenReportRow>((a, b) => b.priorityScore - a.priorityScore).buildFrom(rows);
  },

  
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

  
  async processNext(adminId: number) {
    const heap = this.buildHeap(await this.loadOpenReports());
    const top = heap.pop();
    if (!top) {
      return { processed: false, report: null, route: null };
    }

    const { route, team, teamSource } = await routingService.routeToReport(top.id);

    
    
    const report = await adminService.assignWorker(
      adminId,
      top.id,
      team && teamSource === 'nearest' ? { workerId: team.id } : {}
    );

    return { processed: true, report, route, team, teamSource };
  },
};
