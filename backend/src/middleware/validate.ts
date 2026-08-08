import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

/** Validates `req.body` against a zod schema; replaces body with the parsed value. */
export function validateBody<T>(schema: ZodType<T>): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(result.error);
      return;
    }
    req.body = result.data;
    next();
  };
}
