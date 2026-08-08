import { apiClient } from './client';
import type {
  AdminLog,
  AdminUser,
  ContactMessageList,
  DashboardData,
  DispatchResult,
  NotificationList,
  Paginated,
  PriorityQueueSnapshot,
  Report,
  ReportDetail,
  ReportRoute,
  ReportStatus,
  Severity,
  StatisticsData,
  UserListResult,
  Worker,
} from '../types';

export interface AdminReportParams {
  page?: number;
  limit?: number;
  status?: ReportStatus;
  severity?: Severity;
  municipality?: string;
  ward?: string;
  roadName?: string;
  search?: string;
  reporter?: string;
  from?: string;
  to?: string;
  sort?: 'newest' | 'oldest' | 'priority' | 'severity' | 'status';
}

export type AdminExportFormat = 'csv' | 'xlsx' | 'pdf';

export type StatisticsPeriod = 'day' | 'week' | 'month' | 'year';

/** Admin API surface — mirrors backend/src/routes/admin.routes.ts. */
export const adminApi = {
  dashboard: () => apiClient.get('/admin/dashboard').then((r) => r as unknown as DashboardData),

  statistics: (period: StatisticsPeriod = 'month') =>
    apiClient.get('/admin/statistics', { params: { period } }).then((r) => r as unknown as StatisticsData),

  reports: (params: AdminReportParams = {}) =>
    apiClient.get('/admin/reports', { params }).then((r) => r as unknown as Paginated<Report>),

  reportDetail: (id: number) =>
    apiClient.get(`/admin/reports/${id}`).then((r) => r as unknown as { report: ReportDetail }),

  /** Multipart status transition — status, remarks, optional image file. */
  updateStatus: (id: number, form: FormData) =>
    apiClient.put(`/admin/reports/${id}/status`, form).then((r) => r as unknown as { report: ReportDetail }),

  assign: (id: number, body: { workerId?: number; assignedTo?: string }) =>
    apiClient.post(`/admin/reports/${id}/assign`, body).then((r) => r as unknown as { report: ReportDetail }),

  /** Verify-AI — confirm or reject the detection; rejection also rejects the report. */
  verifyAi: (id: number, body: { approved: boolean; reason?: string }) =>
    apiClient.post(`/admin/reports/${id}/ai-verify`, body).then((r) => r as unknown as { report: ReportDetail }),

  remove: (id: number) => apiClient.delete(`/reports/${id}`),

  users: (params: { page?: number; limit?: number; search?: string; role?: string; active?: boolean; isWorker?: boolean } = {}) =>
    apiClient.get('/admin/users', { params }).then((r) => r as unknown as UserListResult),

  contactMessages: (params: { page?: number; limit?: number; search?: string } = {}) =>
    apiClient.get('/admin/contact-messages', { params }).then((r) => r as unknown as ContactMessageList),

  updateUser: (
    id: number,
    body: { role?: 'USER' | 'ADMIN'; isActive?: boolean; isWorker?: boolean; latitude?: number; longitude?: number }
  ) => apiClient.put(`/admin/users/${id}`, body).then((r) => r as unknown as { user: AdminUser }),

  workers: () => apiClient.get('/admin/workers').then((r) => r as unknown as { workers: Worker[] }),

  /** Max-heap priority queue (ordered, highest first). */
  priorityQueue: () =>
    apiClient.get('/admin/priority-queue').then((r) => r as unknown as PriorityQueueSnapshot),

  /** Dispatch the peak of the heap — assign the nearest crew and move to ASSIGNED. */
  dispatchNext: () =>
    apiClient.post('/admin/priority-queue/process-next').then((r) => r as unknown as DispatchResult),

  /** Dijkstra route from the crew to a report (recomputed on every call). */
  reportRoute: (id: number) =>
    apiClient.get(`/admin/reports/${id}/route`).then((r) => r as unknown as ReportRoute),

  logs: (limit = 20) =>
    apiClient.get('/admin/logs', { params: { limit } }).then((r) => r as unknown as { logs: AdminLog[] }),

  /**
   * Streams an export through the browser. The plain <a href> cannot carry the
   * Authorization header, so we fetch a blob with the shared axios client
   * (which attaches the token) and trigger a download from an object URL.
   */
  downloadExport: async (format: AdminExportFormat, params: AdminReportParams = {}) => {
    const data = (await apiClient.get(`/admin/export/${format}`, { params, responseType: 'blob' })) as unknown as Blob;
    if (!(data instanceof Blob)) return;
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roadguard-reports.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};

/** Notifications feed — used by the admin topbar and dashboards. */
export const notificationsApi = {
  list: () => apiClient.get('/notifications').then((r) => r as unknown as NotificationList),
  markRead: (id: number) => apiClient.put(`/notifications/${id}/read`).then((r) => r as unknown as NotificationList),
  markAllRead: () => apiClient.put('/notifications/read-all').then((r) => r as unknown as NotificationList),
};
