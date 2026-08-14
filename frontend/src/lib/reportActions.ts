import type { ReportStatus } from '../types';


const ACTIVE_WORK: ReportStatus[] = ['ASSIGNED', 'IN_PROGRESS'];


export function canUserDeleteReport(status: ReportStatus): boolean {
  return !ACTIVE_WORK.includes(status);
}
