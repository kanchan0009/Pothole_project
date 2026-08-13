import { prisma } from '../src/config/prisma.js';

try {
  const count = await prisma.user.count();
  console.log('prisma.ts OK — users:', count);
} catch (err) {
  console.error('FAIL:', err instanceof Error ? err.message : err);
} finally {
  await prisma.$disconnect();
}
