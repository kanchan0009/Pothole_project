import type { Request, Response } from 'express';
import { adminService } from '../services/admin.service.js';
import { authService } from '../services/auth.service.js';
import { reportService } from '../services/report.service.js';
import { buildPdf, buildXlsx, toCsv } from '../utils/exporters.js';
import {
  aiVerificationSchema,
  assignSchema,
  reportRouteQuerySchema,
  listUsersSchema,
  statisticsSchema,
  updateUserSchema,
  exportSchema,
} from '../validations/admin.schema.js';
import { listReportsSchema, reportIdSchema } from '../validations/report.schema.js';


export const adminController = {
  
  async login(req: Request, res: Response) {
    const result = await authService.login(req.body, 'ADMIN');
    res.json({ success: true, data: result });
  },

  async dashboard(req: Request, res: Response) {
    const data = await adminService.dashboard(req.user!.id);
    res.json({ success: true, data });
  },

  async statistics(req: Request, res: Response) {
    const { period, from, to } = statisticsSchema.parse(req.query);
    const data = await adminService.statistics(period, from, to);
    res.json({ success: true, data });
  },

  
  async reports(req: Request, res: Response) {
    const query = listReportsSchema.parse(req.query);
    const { sort, page, limit, ...filters } = query;
    const data = await reportService.list({ page, limit, sort, filters });
    res.json({ success: true, data });
  },

  async reportDetail(req: Request, res: Response) {
    const { id } = reportIdSchema.parse(req.params);
    const report = await reportService.getReport(id);
    res.json({ success: true, data: { report } });
  },

  
  async updateStatus(req: Request, res: Response) {
    const { id } = reportIdSchema.parse(req.params);
    const report = await adminService.transitionStatus(req.user!.id, id, req.body, req.file);
    res.json({ success: true, message: 'Report status updated', data: { report } });
  },

  async assignWorker(req: Request, res: Response) {
    const { id } = reportIdSchema.parse(req.params);
    const input = assignSchema.parse(req.body);
    const report = await adminService.assignWorker(req.user!.id, id, input);
    res.json({ success: true, message: 'Worker assigned', data: { report } });
  },

  async verifyAi(req: Request, res: Response) {
    const { id } = reportIdSchema.parse(req.params);
    const input = aiVerificationSchema.parse(req.body);
    const report = await adminService.verifyAi(req.user!.id, id, input);
    res.json({ success: true, message: 'AI verification recorded', data: { report } });
  },

  
  async priorityQueue(_req: Request, res: Response) {
    const data = await adminService.priorityQueue();
    res.json({ success: true, data });
  },

  
  async dispatchNext(req: Request, res: Response) {
    const data = await adminService.dispatchNext(req.user!.id);
    res.json({ success: true, message: data.processed ? 'Highest-priority report dispatched' : 'Queue is empty', data });
  },

  
  async reportRoute(req: Request, res: Response) {
    const { id } = reportIdSchema.parse(req.params);
    const { workerId } = reportRouteQuerySchema.parse(req.query);
    const data = await adminService.reportRoute(id, workerId ? { workerId } : undefined);
    res.json({ success: true, data });
  },

  async users(req: Request, res: Response) {
    const query = listUsersSchema.parse(req.query);
    const data = await adminService.listUsers(query);
    res.json({ success: true, data });
  },

  async updateUser(req: Request, res: Response) {
    const { id } = reportIdSchema.parse(req.params);
    const user = await adminService.updateUser(req.user!.id, id, updateUserSchema.parse(req.body));
    res.json({ success: true, message: 'User updated', data: { user } });
  },

  async workers(_req: Request, res: Response) {
    const data = await adminService.listWorkers();
    res.json({ success: true, data: { workers: data } });
  },

  async logs(req: Request, res: Response) {
    const limit = Number(req.query.limit ?? 20);
    const logs = await adminService.logs(Number.isFinite(limit) ? limit : 20);
    res.json({ success: true, data: { logs } });
  },

  
  async exportReports(req: Request, res: Response) {
    const { format, ...filters } = exportSchema.parse({ format: req.params.format, ...req.query });
    const rows = await adminService.exportReports(filters);
    const stamp = new Date().toISOString().slice(0, 10);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="roadguard-reports-${stamp}.csv"`);
      res.send(toCsv(rows));
      return;
    }

    if (format === 'xlsx') {
      const buffer = await buildXlsx(rows);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="roadguard-reports-${stamp}.xlsx"`);
      res.send(buffer);
      return;
    }

    const buffer = await buildPdf(rows);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="roadguard-reports-${stamp}.pdf"`);
    res.send(buffer);
  },
};
