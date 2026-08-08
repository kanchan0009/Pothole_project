/** Radius (meters) within which an open report is considered a duplicate. */
export const DUPLICATE_RADIUS_M = 20;

/**
 * Which report statuses are "open" and therefore eligible to be flagged as
 * a duplicate target (closed/rejected reports no longer count).
 */
export const OPEN_STATUSES = ['PENDING', 'VERIFIED', 'ASSIGNED', 'IN_PROGRESS'] as const;
