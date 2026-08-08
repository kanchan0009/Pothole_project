import { describe, expect, it } from 'vitest';
import type { Severity, Status } from '@prisma/client';
import { computePriorityScore, SEVERITY_WEIGHT } from '../../src/algorithms/priority.js';
import { priorityQueueService } from '../../src/services/priorityQueue.service.js';

/** Structural match of the service's (non-exported) OpenReportRow. */
interface Row {
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

function row(id: number, severity: Severity, extra: Partial<Row> = {}): Row {
  return {
    id,
    title: `Report ${id}`,
    severity,
    status: 'PENDING',
    priorityScore: computePriorityScore(severity, 0, 0, 0),
    confirmations: 0,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    latitude: 27.7,
    longitude: 85.32,
    municipality: 'Kathmandu',
    ward: '1',
    ...extra,
  };
}

describe('computePriorityScore (queue ordering factor)', () => {
  it('ranks severities by their weight', () => {
    const low = computePriorityScore('LOW', 0, 0, 0);
    const critical = computePriorityScore('CRITICAL', 0, 0, 0);
    expect(critical).toBeGreaterThan(low);
  });

  it('a confirmed report outranks a fresh one at the same severity', () => {
    const base = computePriorityScore('MEDIUM', 0, 0, 0);
    const confirmed = computePriorityScore('MEDIUM', 3, 0, 0);
    expect(confirmed).toBeGreaterThan(base);
  });

  it('caps confirmations at 4 for scoring purposes', () => {
    const capped = computePriorityScore('HIGH', 20, 0, 0);
    expect(capped).toBe(computePriorityScore('HIGH', 4, 0, 0));
  });

  it('ages the queue — older reports climb over identical younger ones', () => {
    expect(computePriorityScore('LOW', 0, 10, 0)).toBeGreaterThan(computePriorityScore('LOW', 0, 1, 0));
    expect(computePriorityScore('LOW', 0, 10, 0)).toBe(SEVERITY_WEIGHT.LOW + 10);
  });
});

describe('priorityQueueService.buildHeap — the max heap', () => {
  it('pops reports in descending priority order', () => {
    const rows: Row[] = [
      row(1, 'LOW', { confirmations: 0 }),
      row(2, 'CRITICAL'),
      row(3, 'MEDIUM'),
      row(4, 'HIGH'),
    ];
    const heap = priorityQueueService.buildHeap(rows);
    expect(heap.size).toBe(4);
    const popped = [];
    while (!heap.isEmpty) popped.push(heap.pop()!.id);
    expect(popped).toEqual([2, 4, 3, 1]);
  });

  it('keeps both entries of a priority tie (order among equals is unspecified)', () => {
    const rows: Row[] = [
      row(1, 'LOW'),
      row(2, 'LOW', { priorityScore: 999 }),
      row(3, 'LOW'),
      row(4, 'LOW', { priorityScore: 999 }),
    ];
    const heap = priorityQueueService.buildHeap(rows);
    const popped: Row[] = [];
    while (!heap.isEmpty) popped.push(heap.pop()!);
    expect(popped.map((r) => r.priorityScore)).toEqual([999, 999, 10, 10]);
    expect(new Set(popped.slice(0, 2).map((r) => r.id))).toEqual(new Set([2, 4]));
    expect(new Set(popped.slice(2).map((r) => r.id))).toEqual(new Set([1, 3]));
  });

  it('an empty heap pops undefined and reports size 0', () => {
    const heap = priorityQueueService.buildHeap([]);
    expect(heap.isEmpty).toBe(true);
    expect(heap.size).toBe(0);
    expect(heap.peek()).toBeUndefined();
    expect(heap.pop()).toBeUndefined();
  });
});
