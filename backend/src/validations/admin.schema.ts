import { Role, Severity, Status } from '@prisma/client';
import { z } from 'zod';




export const statusUpdateSchema = z.object({
  status: z.nativeEnum(Status),
  remarks: z.string().trim().max(500, 'Remarks are too long').optional(),
  
  workerId: z.coerce.number().int().positive().optional(),
  assignedTo: z.string().trim().max(120).optional(),
});


export const reportRouteQuerySchema = z.object({
  workerId: z.coerce.number().int().positive().optional(),
});


export const assignSchema = z
  .object({
    workerId: z.coerce.number().int().positive().optional(),
    assignedTo: z.string().trim().max(120).optional(),
  })
  .refine((d) => !(d.workerId && d.assignedTo), {
    message: 'Provide either workerId or assignedTo, not both',
    path: ['workerId'],
  });

const booleanish = z.preprocess(
  (v) => (v === 'true' ? true : v === 'false' ? false : v),
  z.boolean().optional()
);


export const listUsersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  search: z.string().trim().optional(),
  role: z.nativeEnum(Role).optional(),
  active: booleanish,
  isWorker: booleanish,
});


export const updateUserSchema = z
  .object({
    role: z.nativeEnum(Role).optional(),
    isActive: z.boolean().optional(),
    isWorker: z.boolean().optional(),
    
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
  })
  .refine(
    (d) =>
      d.role !== undefined ||
      d.isActive !== undefined ||
      d.isWorker !== undefined ||
      d.latitude !== undefined ||
      d.longitude !== undefined,
    {
      message: 'Nothing to update',
      path: ['role'],
    }
  )
  .refine((d) => (d.latitude !== undefined) === (d.longitude !== undefined), {
    message: 'latitude and longitude must be provided together',
    path: ['latitude'],
  });


export const aiVerificationSchema = z
  .object({
    approved: z.boolean(),
    reason: z.enum(['NOT_A_POTHOLY', 'DUPLICATE', 'BLURRED_IMAGE', 'FAKE_REPORT']).optional(),
  })
  .refine((d) => d.approved || d.reason !== undefined, {
    message: 'A rejection reason is required',
    path: ['reason'],
  });


export const statisticsSchema = z.object({
  period: z.enum(['day', 'week', 'month', 'year']).default('month'),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});


export const exportSchema = z.object({
  format: z.enum(['csv', 'xlsx', 'pdf']),
  status: z.nativeEnum(Status).optional(),
  severity: z.nativeEnum(Severity).optional(),
  municipality: z.string().trim().optional(),
  ward: z.string().trim().optional(),
  search: z.string().trim().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type StatusUpdateInput = z.infer<typeof statusUpdateSchema>;
export type AssignInput = z.infer<typeof assignSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
