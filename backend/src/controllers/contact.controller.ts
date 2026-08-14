import type { Request, Response } from 'express';
import { contactService } from '../services/contact.service.js';
import { contactListSchema } from '../validations/contact.schema.js';

export const contactController = {
  async submit(req: Request, res: Response): Promise<void> {
    const submission = await contactService.submit(req.body);
    res.status(201).json({ success: true, data: submission });
  },

  
  async list(req: Request, res: Response): Promise<void> {
    const query = contactListSchema.parse(req.query);
    const data = await contactService.listMessages(query);
    res.json({ success: true, data });
  },

  async reply(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const { replyText } = req.body;
    if (!id || !replyText) {
      res.status(400).json({ success: false, error: { message: 'Missing id or replyText' } });
      return;
    }
    await contactService.replyMessage(parseInt(id, 10), replyText);
    res.json({ success: true });
  },
};
