import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { env } from '../config/env.js';
import { ApiError } from './ApiError.js';

export interface AccessTokenPayload {
  id: number;
  email: string;
  role: Role;
}

export interface RefreshTokenPayload {
  id: number;
  type: 'refresh';
  /** Unique per-issuance nonce — two tokens for the same user are never identical,
   *  which is what makes rotation/reuse detection meaningful. */
  jti: string;
}

export interface ResetTokenPayload {
  id: number;
  type: 'reset';
}

const REFRESH_TTL_REMEMBER = '30d';

/** Short-lived access token carrying the auth identity. */
export function signAccessToken(user: { id: number; email: string; role: Role }): string {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role } satisfies AccessTokenPayload,
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES as jwt.SignOptions['expiresIn'] }
  );
}

/** Rotatable refresh token. "Remember me" extends the session to 30 days. */
export function signRefreshToken(userId: number, rememberMe: boolean): string {
  return jwt.sign(
    { id: userId, type: 'refresh', jti: crypto.randomUUID() } satisfies RefreshTokenPayload,
    env.JWT_REFRESH_SECRET,
    { expiresIn: (rememberMe ? REFRESH_TTL_REMEMBER : env.JWT_REFRESH_EXPIRES) as jwt.SignOptions['expiresIn'] }
  );
}

/** One-time password-reset token (short-lived). */
export function signResetToken(userId: number): string {
  return jwt.sign({ id: userId, type: 'reset' } satisfies ResetTokenPayload, env.JWT_REFRESH_SECRET, {
    expiresIn: '15m' as jwt.SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
  } catch {
    throw ApiError.forbidden('Invalid or expired token');
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as jwt.JwtPayload;
  if (payload.type !== 'refresh') {
    throw ApiError.forbidden('Invalid token type');
  }
  return { id: payload.id as number, type: 'refresh', jti: payload.jti as string };
}

export function verifyResetToken(token: string): ResetTokenPayload {
  const payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as jwt.JwtPayload;
  if (payload.type !== 'reset') {
    throw ApiError.forbidden('Invalid token type');
  }
  return { id: payload.id as number, type: 'reset' };
}

/** Stores only a SHA-256 hash of the refresh token in the DB. */
export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
