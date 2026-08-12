import type { ReportStatus } from '../types';

/** Statuses where field work has started — owner cannot delete the report yet. */
const ACTIVE_WORK: ReportStatus[] = ['ASSIGNED', 'IN_PROGRESS'];

/** True when the reporter may permanently delete this report. */
export function canUserDeleteReport(status: ReportStatus): boolean {
  return !ACTIVE_WORK.includes(status);
}
