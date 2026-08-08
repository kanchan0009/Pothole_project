import type { Request, Response } from 'express';
import { contactService } from '../services/contact.service.js';
import { contactListSchema } from '../validations/contact.schema.js';

export const contactController = {
  async submit(req: Request, res: Response): Promise<void> {
    const submission = await contactService.submit(req.body);
    res.status(201).json({ success: true, data: submission });
  },

  /** Admin only — routed from admin.routes.ts under the adminOnly guard. */
  async list(req: Request, res: Response): Promise<void> {
    const query = contactListSchema.parse(req.query);
    const data = await contactService.listMessages(query);
    res.json({ success: true, data });
  },
};
