import type { Role } from '@prisma/client';

/** Augments Express's Request with the authenticated user context. */
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        role: Role;
      };
    }
  }
}

export {};
