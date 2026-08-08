import { prisma } from '../../src/config/prisma.js';

/**
 * Empties every table in FK-safe order. Call from each test file's beforeAll
 * so the shared SQLite file starts clean regardless of which file ran first.
 */
export async function cleanDb(): Promise<void> {
  await prisma.contactMessage.deleteMany();
  await prisma.adminLog.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.statusHistory.deleteMany();
  await prisma.location.deleteMany();
  await prisma.report.deleteMany();
  await prisma.user.deleteMany();
}
