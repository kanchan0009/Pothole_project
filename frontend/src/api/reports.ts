import { apiClient } from './client';
import type {
  DetectionResult,
  Paginated,
  Report,
  ReportDetail,
  ReportStatus,
  Severity,
  StatusCounts,
  StatusHistoryEntry,
} from '../types';

export interface ReportListParams {
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

export interface NearbyReport {
  id: number;
  title: string;
  distance: number; // meters
  imageUrl: string;
  status: ReportStatus;
  severity: Severity;
  createdAt: string;
}

export interface CheckDuplicateResult {
  duplicate: boolean;
  nearbyReport?: NearbyReport;
}

export type CreateReportResult =
  | { ok: true; report: Report }
  | { ok: false; reason: 'duplicate'; nearbyReport: NearbyReport };

/** The Axios response interceptor unwraps { success, data } → data. */
export const reportsApi = {
  list: (params: ReportListParams = {}) =>
    apiClient.get('/reports', { params }).then((r) => r as unknown as Paginated<Report>),

  /** The caller's own reports — the backend forces userId, never public. */
  mine: (params: ReportListParams = {}) =>
    apiClient.get('/reports/mine', { params }).then((r) => r as unknown as Paginated<Report>),

  /** Per-status counts for the caller's reports (dashboard summary cards). */
  mineStats: () =>
    apiClient.get('/reports/mine/stats').then((r) => r as unknown as { status: StatusCounts }),

  get: (id: number) =>
    apiClient.get(`/reports/${id}`).then((r) => r as unknown as { report: ReportDetail }),

  timeline: (id: number) =>
    apiClient.get(`/reports/${id}/timeline`).then((r) => r as unknown as { history: StatusHistoryEntry[] }),

  /**
   * Downloads the official PDF receipt for the caller's report. The plain
   * <a href> can't carry the Authorization header, so we fetch a blob through
   * the shared client (which attaches the token) and save it locally.
   */
  receipt: async (id: number) => {
    const data = (await apiClient.get(`/reports/${id}/receipt`, { responseType: 'blob' })) as unknown as Blob;
    if (!(data instanceof Blob)) return;
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RoadGuard-Receipt-${id}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  checkDuplicate: (latitude: number, longitude: number) =>
    apiClient
      .post('/reports/check-duplicate', { latitude, longitude })
      .then((r) => r as unknown as CheckDuplicateResult),

  /** Step-2 AI gate — detect a pothole in the chosen photo before the form proceeds. */
  detect: async (file: File) => {
    const form = new FormData();
    const name = file.name?.trim() || "photo.jpg";
    form.append("image", file, name.endsWith(".") ? "photo.jpg" : name);
    return (await apiClient.post("/reports/detect", form)) as unknown as DetectionResult;
  },

  async create(form: FormData): Promise<CreateReportResult> {
    try {
      const data = (await apiClient.post('/reports', form)) as unknown as { report: Report };
      return { ok: true, report: data.report };
    } catch (err) {
      const e = err as Error & { responseData?: { code?: string; nearbyReport?: NearbyReport } };
      if (e.responseData?.code === 'DUPLICATE_REPORT') {
        return { ok: false, reason: 'duplicate', nearbyReport: e.responseData.nearbyReport! };
      }
      throw err;
    }
  },

  update: (id: number, form: FormData) =>
    apiClient.put(`/reports/${id}`, form).then((r) => r as unknown as { report: Report }),

  remove: (id: number) => apiClient.delete(`/reports/${id}`),

  /** Permanently deletes the caller's report (owner-only). */
  removeForUser: (id: number) => apiClient.post(`/reports/${id}/remove-user`),
};
