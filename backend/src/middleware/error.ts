import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

/** 404 for unknown routes. */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: { message: `Route not found: ${req.method} ${req.originalUrl}` },
  });
}

/** Centralized error handler — last resort, keeps responses consistent. */
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  // Request validation (zod)
  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      fields[issue.path.join('.')] = issue.message;
    }
    res.status(400).json({ success: false, error: { message: 'Validation failed', fields } });
    return;
  }

  // Operational errors thrown by our code
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      error: { message: err.message, fields: err.fields },
    });
    return;
  }

  // Prisma known errors → friendly messages
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({ success: false, error: { message: 'A record with that value already exists.' } });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ success: false, error: { message: 'Record not found.' } });
      return;
    }
    if (err.code === 'P2003') {
      res.status(400).json({ success: false, error: { message: 'Related record does not exist.' } });
      return;
    }
  }

  // Multer file-size limit
  if (err instanceof Error && 'code' in err && (err as { code?: string }).code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ success: false, error: { message: 'File too large. Maximum size is 5 MB.' } });
    return;
  }

  // Anything else → 500
  console.error('💥 Unhandled error:', err);
  const message =
    env.NODE_ENV === 'production' ? 'Internal server error' : err instanceof Error ? err.message : 'Unknown error';
  res.status(500).json({ success: false, error: { message } });
}
