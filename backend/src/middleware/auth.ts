import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@prisma/client';
import { verifyAccessToken } from '../utils/tokens.js';
import { ApiError } from '../utils/ApiError.js';


function extractBearer(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return undefined;
  return header.slice(7).trim();
}


export function authenticateToken(req: Request, _res: Response, next: NextFunction): void {
  const token = extractBearer(req);
  if (!token) {
    next(ApiError.unauthorized('Access token required'));
    return;
  }
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.id, email: payload.email, role: payload.role };
    next();
  } catch (err) {
    next(err);
  }
}


export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractBearer(req);
  if (!token) {
    next();
    return;
  }
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.id, email: payload.email, role: payload.role };
  } catch {
    
  }
  next();
}


export function requireRole(...roles: Role[]): (req: Request, _res: Response, next: NextFunction) => void {
  return (req, _res, next) => {
    if (!req.user) {
      next(ApiError.unauthorized());
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(ApiError.forbidden('Insufficient permissions for this action'));
      return;
    }
    next();
  };
}
