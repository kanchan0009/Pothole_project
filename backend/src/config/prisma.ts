import { PrismaClient } from '@prisma/client';

/** Supabase/Postgres require SSL; append if missing from the connection string. */
function postgresUrl(raw: string | undefined): string | undefined {
  if (!raw?.startsWith('postgresql')) return raw;
  if (raw.includes('sslmode=')) return raw;
  return `${raw}${raw.includes('?') ? '&' : '?'}sslmode=require`;
}

/** Shared Prisma client — single connection across the app. */
export const prisma = new PrismaClient({
  datasources: {
    db: { url: postgresUrl(process.env.DATABASE_URL) },
  },
});
