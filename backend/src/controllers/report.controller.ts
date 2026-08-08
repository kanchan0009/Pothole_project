import type { Request, Response } from 'express';
import { detectionService } from '../services/detection.service.js';
import { reportService } from '../services/report.service.js';
import { listReportsSchema, reportIdSchema } from '../validations/report.schema.js';

/** Thin HTTP layer — business logic lives in the report/detection services. */
export const reportController = {
  async create(req: Request, res: Response) {
    const { ignoreDuplicate, skipDetection, ...input } = req.body;
    const result = await reportService.create(req.user!.id, input, req.file, ignoreDuplicate, skipDetection);
    if (!result.ok) {
      res.status(409).json({
        success: false,
        error: {
          message: 'This pothole has already been reported. You can track the existing report instead of creating a duplicate.',
          code: 'DUPLICATE_REPORT',
          nearbyReport: result.nearbyReport,
        },
      });
      return;
    }
    res.status(201).json({ success: true, data: { report: result.report } });
  },

  async list(req: Request, res: Response) {
    const query = listReportsSchema.parse(req.query);
    const { sort, page, limit, ...filters } = query;
    const result = await reportService.list({ page, limit, sort, filters });
    res.json({ success: true, data: result });
  },

  async mine(req: Request, res: Response) {
    const query = listReportsSchema.parse(req.query);
    const { sort, page, limit, ...filters } = query;
    // Force the caller as the owner — a citizen can never read someone else's list.
    const result = await reportService.list({ page, limit, sort, filters: { ...filters, userId: req.user!.id } });
    res.json({ success: true, data: result });
  },

  async mineStats(req: Request, res: Response) {
    const status = await reportService.mineStats(req.user!.id);
    res.json({ success: true, data: { status } });
  },

  async detail(req: Request, res: Response) {
    const { id } = reportIdSchema.parse(req.params);
    const report = await reportService.getReport(id);
    res.json({ success: true, data: { report } });
  },

  async timeline(req: Request, res: Response) {
    const { id } = reportIdSchema.parse(req.params);
    const history = await reportService.getTimeline(id);
    res.json({ success: true, data: { history } });
  },

  /** Streams the owner/admin-only PDF receipt as an attachment. */
  async receipt(req: Request, res: Response) {
    const { id } = reportIdSchema.parse(req.params);
    const { ref, pdf } = await reportService.getReceipt(req.user!.id, req.user!.role, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${ref}-receipt.pdf"`);
    res.setHeader('Content-Length', String(pdf.length));
    res.send(pdf);
  },

  async update(req: Request, res: Response) {
    const { id } = reportIdSchema.parse(req.params);
    const report = await reportService.update(req.user!.id, req.user!.role, id, req.body, req.file);
    res.json({ success: true, message: 'Report updated', data: { report } });
  },

  async remove(req: Request, res: Response) {
    const { id } = reportIdSchema.parse(req.params);
    await reportService.remove(id);
    res.json({ success: true, message: 'Report deleted' });
  },

  async removeForUser(req: Request, res: Response) {
    const { id } = reportIdSchema.parse(req.params);
    await reportService.removeForUser(req.user!.id, id);
    res.json({ success: true, message: 'The completed report has been removed from your dashboard.' });
  },

  async checkDuplicate(req: Request, res: Response) {
    const result = await reportService.checkDuplicate(req.body.latitude, req.body.longitude);
    res.json({ success: true, data: result });
  },

  /** Step-2 AI gate — detect a pothole in the uploaded photo before the form proceeds. */
  async detect(req: Request, res: Response) {
    const result = await detectionService.detect(req.file);
    res.json({ success: true, data: result });
  },
};
