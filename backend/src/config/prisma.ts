import { PrismaClient } from '@prisma/client';

/** Shared Prisma client — single connection across the app. */
export const prisma = new PrismaClient();
