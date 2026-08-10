import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Role, User } from '@prisma/client';
import { OAuth2Client } from 'google-auth-library';
import { userRepo } from '../repositories/user.repo.js';
import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import {
  hashRefreshToken,
  signAccessToken,
  signRefreshToken,
  signResetToken,
  verifyRefreshToken,
  verifyResetToken,
} from '../utils/tokens.js';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export interface AuthResult {
  token: string;
  refreshToken: string;
  user: PublicUser;
}

export type PublicUser = Pick<User, 'id' | 'name' | 'email' | 'phone' | 'role' | 'isActive' | 'createdAt'>;

/** Removes sensitive fields before returning a user to the client. */
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

async function issueSession(user: User, rememberMe: boolean): Promise<AuthResult> {
  const accessToken = signAccessToken({ id: user.id, email: user.email, role: user.role });
  const refreshToken = signRefreshToken(user.id, rememberMe);
  await userRepo.setRefreshToken(user.id, hashRefreshToken(refreshToken));
  return { token: accessToken, refreshToken, user: toPublicUser(user) };
}

export const authService = {
  async register(input: { name: string; email: string; phone?: string; password: string }): Promise<AuthResult> {
    const existing = await userRepo.findByEmail(input.email);
    if (existing) {
      throw ApiError.conflict('An account with this email already exists');
    }

    const passwordHash = bcrypt.hashSync(input.password, 12);
    const user = await userRepo.create({
      name: input.name,
      email: input.email,
      phone: input.phone,
      passwordHash,
      role: 'USER',
    });

    // Welcome notification
    await prisma.notification.create({
      data: {
        userId: user.id,
        title: 'Welcome to RoadGuard',
        message: 'Thank you for registering. Start reporting road hazards in your community.',
      },
    });

    return issueSession(user, false);
  },

  async login(
    input: { email: string; password: string; rememberMe?: boolean },
    expectedRole?: Role
  ): Promise<AuthResult> {
    const user = await userRepo.findByEmail(input.email);
    if (!user) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    if (!user.passwordHash) {
      throw ApiError.unauthorized('This account uses Google Sign-In. Please sign in with Google.');
    }

    const valid = bcrypt.compareSync(input.password, user.passwordHash);
    if (!valid) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    if (!user.isActive) {
      throw ApiError.forbidden('This account has been deactivated. Contact support.');
    }

    if (expectedRole && user.role !== expectedRole) {
      throw ApiError.forbidden('This account does not have admin access');
    }

    return issueSession(user, input.rememberMe ?? false);
  },

  async googleLogin(idToken: string): Promise<AuthResult> {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      throw ApiError.unauthorized('Invalid Google token');
    }

    const { email, name, sub: googleId } = payload;
    
    let user = await userRepo.findByEmail(email);
    if (user) {
      if (!user.googleId) {
        user = await userRepo.update(user.id, { googleId });
      }
    } else {
      user = await prisma.user.create({
        data: {
          name: name || 'Google User',
          email,
          googleId,
          role: 'USER',
        }
      });
      await prisma.notification.create({
        data: {
          userId: user.id,
          title: 'Welcome to RoadGuard',
          message: 'Thank you for registering via Google. Start reporting road hazards in your community.',
        },
      });
    }

    if (!user.isActive) {
      throw ApiError.forbidden('This account has been deactivated. Contact support.');
    }

    return issueSession(user, true);
  },

  async refresh(refreshToken: string): Promise<{ token: string; refreshToken: string }> {
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw ApiError.unauthorized('Invalid or expired refresh token');
    }

    const user = await userRepo.findById(payload.id);
    if (!user || user.refreshToken !== hashRefreshToken(refreshToken)) {
      // Token reuse / mismatch → revoke the session entirely
      if (user) await userRepo.setRefreshToken(user.id, null);
      throw ApiError.unauthorized('Refresh token no longer valid');
    }

    const accessToken = signAccessToken({ id: user.id, email: user.email, role: user.role });
    const newRefreshToken = signRefreshToken(user.id, false);
    await userRepo.setRefreshToken(user.id, hashRefreshToken(newRefreshToken));

    return { token: accessToken, refreshToken: newRefreshToken };
  },

  async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) return;
    try {
      const payload = verifyRefreshToken(refreshToken);
      const user = await userRepo.findById(payload.id);
      // Only clear if the presented token matches the stored session
      if (user && user.refreshToken === hashRefreshToken(refreshToken)) {
        await userRepo.setRefreshToken(user.id, null);
      }
    } catch {
      /* already invalid — nothing to revoke */
    }
  },

  async forgotPassword(email: string): Promise<void> {
    const user = await userRepo.findByEmail(email);
    if (!user) return; // never reveal whether the email exists

    if (!user.passwordHash) {
      // User signed up with Google, shouldn't send reset link
      return; 
    }

    const token = signResetToken(user.id);
    const resetLink = `http://localhost:5173/reset-password?token=${token}`;
    // Dev delivery: log the link (wire up a real mailer/queue in production).
    console.log(`🔑 Password reset for ${user.email}: ${resetLink}`);
  },

  async resetPassword(token: string, password: string): Promise<void> {
    const payload = verifyResetToken(token);
    const user = await userRepo.findById(payload.id);
    if (!user) {
      throw ApiError.badRequest('Invalid or expired reset token');
    }
    const passwordHash = bcrypt.hashSync(password, 12);
    await userRepo.update(user.id, { passwordHash });
    // Revoke all existing sessions after a password change.
    await userRepo.setRefreshToken(user.id, null);
  },

  async getProfile(userId: number): Promise<PublicUser> {
    const user = await userRepo.findById(userId);
    if (!user) {
      throw ApiError.notFound('User not found');
    }
    return toPublicUser(user);
  },

  async updateProfile(
    userId: number,
    input: { name?: string; phone?: string | null; currentPassword?: string; newPassword?: string }
  ): Promise<PublicUser> {
    const user = await userRepo.findById(userId);
    if (!user) {
      throw ApiError.notFound('User not found');
    }

    const data: { name?: string; phone?: string | null; passwordHash?: string } = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.phone !== undefined) data.phone = input.phone ?? null;

    if (input.newPassword) {
      if (!user.passwordHash) {
         throw ApiError.badRequest('This account uses Google Sign-In and cannot have a password set this way.');
      }
      if (!input.currentPassword || !bcrypt.compareSync(input.currentPassword, user.passwordHash)) {
        throw ApiError.badRequest('Current password is incorrect');
      }
      data.passwordHash = bcrypt.hashSync(input.newPassword, 12);
    }

    const updated = await userRepo.update(userId, data);
    return toPublicUser(updated);
  },

  /**
   * Soft-deletes an account: deactivates it and anonymizes every identifying field so
   * the account can never be signed into again, while the user's reports, assignments
   * and audit-log rows keep their referential integrity (a hard delete would break them).
   */
  async deleteAccount(userId: number): Promise<void> {
    const user = await userRepo.findById(userId);
    if (!user) {
      throw ApiError.notFound('User not found');
    }
    if (user.isActive === false) {
      throw ApiError.badRequest('This account is already deactivated');
    }

    await userRepo.update(userId, {
      isActive: false,
      name: 'Deleted user',
      email: `deleted-${userId}@invalid`,
      phone: null,
      passwordHash: bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 12),
      refreshToken: null,
      latitude: null,
      longitude: null,
      googleId: null,
    });
  },
};
