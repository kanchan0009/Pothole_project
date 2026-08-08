import type { Severity } from '@prisma/client';

/** Severity weights — the dominant component of the priority score. */
export const SEVERITY_WEIGHT: Record<Severity, number> = {
  LOW: 10,
  MEDIUM: 20,
  HIGH: 30,
  CRITICAL: 40,
};

/** Bonus per citizen "confirmation" (a new report flagged as a duplicate). */
export const CONFIRMATIONS_WEIGHT = 12;
const MAX_CONFIRMATIONS_BONUS = 4; // cap how many confirmations matter
const MAX_AGE_WEIGHT = 20;
const MAX_TRAFFIC_WEIGHT = 10;

/**
 * Priority score = severity + confirmations + age + traffic.
 * Higher is more urgent; the max-heap serves the top score first.
 *
 * - `severity`      — the CNN severity classification (authoritative).
 * - `confirmations` — how many citizens reported the same pothole (duplicates).
 * - `ageDays`       — time elapsed since reporting (urgency grows with age).
 * - `traffic`       — 0..10 road traffic factor, when known.
 */
export function computePriorityScore(
  severity: Severity,
  confirmations: number,
  ageDays: number,
  traffic: number
): number {
  const severityWeight = SEVERITY_WEIGHT[severity] ?? 0;
  const confirmationsWeight =
    CONFIRMATIONS_WEIGHT * Math.min(MAX_CONFIRMATIONS_BONUS, Math.max(0, confirmations));
  const ageWeight = Math.min(MAX_AGE_WEIGHT, Math.max(0, Math.round(ageDays)));
  const trafficWeight = Math.min(MAX_TRAFFIC_WEIGHT, Math.max(0, Math.round(traffic)));
  return severityWeight + confirmationsWeight + ageWeight + trafficWeight;
}
