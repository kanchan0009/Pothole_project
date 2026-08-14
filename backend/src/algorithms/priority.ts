import type { Severity } from '@prisma/client';


export const SEVERITY_WEIGHT: Record<Severity, number> = {
  LOW: 10,
  MEDIUM: 20,
  HIGH: 30,
  CRITICAL: 40,
};


export const CONFIRMATIONS_WEIGHT = 12;
const MAX_CONFIRMATIONS_BONUS = 4; 
const MAX_AGE_WEIGHT = 20;
const MAX_TRAFFIC_WEIGHT = 10;


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
