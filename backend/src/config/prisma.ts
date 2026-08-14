import { PrismaClient } from '@prisma/client';


function postgresUrl(raw: string | undefined): string | undefined {
  if (!raw?.startsWith('postgresql')) return raw;
  if (raw.includes('sslmode=')) return raw;
  return `${raw}${raw.includes('?') ? '&' : '?'}sslmode=require`;
}


export const prisma = new PrismaClient({
  datasources: {
    db: { url: postgresUrl(process.env.DATABASE_URL) },
  },
});
