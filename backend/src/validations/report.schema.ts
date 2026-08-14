import { Severity, Status } from '@prisma/client';
import { z } from 'zod';


const optionalLatitude = z
  .preprocess((v) => (v === '' || v == null ? undefined : v), z.coerce.number().min(-90).max(90))
  .optional();
const optionalLongitude = z
  .preprocess((v) => (v === '' || v == null ? undefined : v), z.coerce.number().min(-180).max(180))
  .optional();


const ignoreDuplicate = z
  .preprocess((v) => v === true || v === 'true' || v === '1', z.boolean())
  .optional()
  .default(false);


const skipDetection = z
  .preprocess((v) => v === true || v === 'true' || v === '1', z.boolean())
  .optional()
  .default(false);

export const createReportSchema = z.object({
  title: z.string().trim().min(5, 'Title must be at least 5 characters').max(120, 'Title is too long'),
  description: z.string().trim().min(10, 'Please add a little more detail').max(2000, 'Description is too long'),
  roadName: z.string().trim().min(2, 'Road name is required').max(120),
  municipality: z.string().trim().min(2, 'Municipality is required').max(80),
  ward: z.string().trim().min(1, 'Ward is required').max(20),
  landmark: z.string().trim().max(120).optional(),
  latitude: optionalLatitude,
  longitude: optionalLongitude,
  severity: z.nativeEnum(Severity),
  ignoreDuplicate,
  skipDetection,
});

export const updateReportSchema = z.object({
  title: z.string().trim().min(5).max(120).optional(),
  description: z.string().trim().min(10).max(2000).optional(),
  roadName: z.string().trim().min(2).max(120).optional(),
  municipality: z.string().trim().min(2).max(80).optional(),
  ward: z.string().trim().min(1).max(20).optional(),
  landmark: z
    .preprocess((v) => (v === '' ? null : v), z.string().trim().max(120).nullable())
    .optional(),
  latitude: optionalLatitude,
  longitude: optionalLongitude,
  severity: z.nativeEnum(Severity).optional(),
});

export const checkDuplicateSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});

export const reportIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const listReportsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  status: z.nativeEnum(Status).optional(),
  severity: z.nativeEnum(Severity).optional(),
  municipality: z.string().trim().optional(),
  ward: z.string().trim().optional(),
  roadName: z.string().trim().optional(),
  search: z.string().trim().optional(),
  reporter: z.string().trim().optional(),
  userId: z.coerce.number().int().positive().optional(),
  from: z.preprocess((v) => (typeof v === 'string' && v ? new Date(v) : v), z.date()).optional(),
  to: z.preprocess((v) => (typeof v === 'string' && v ? new Date(v) : v), z.date()).optional(),
  sort: z.enum(['newest', 'oldest', 'priority', 'severity', 'status']).default('newest'),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;
export type UpdateReportInput = z.infer<typeof updateReportSchema>;
export type ListReportsQuery = z.infer<typeof listReportsSchema>;
