import { z } from 'zod';


export const contactSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(80, 'Name is too long'),
  email: z.string().trim().toLowerCase().email('A valid email is required'),
  subject: z.string().trim().min(3, 'Subject is too short').max(120, 'Subject is too long'),
  message: z.string().trim().min(10, 'Please write a few more words').max(2000, 'Message is too long'),
});


export const contactListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  search: z.string().trim().max(100, 'Search is too long').optional(),
});
