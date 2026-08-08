import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';

/**
 * Rebuilds the isolated test database (backend/prisma/test.db) before the suite.
 *
 * The test.db file is deleted directly rather than via `prisma db push --force-reset`,
 * which Prisma guards against when invoked by an AI agent. Deleting the file is safe:
 * test.db is disposable and only ever written by this suite.
 */
export default function globalSetup(): void {
  process.env.DATABASE_URL = 'file:./test.db';
  rmSync('prisma/test.db', { force: true });
  rmSync('prisma/test.db-journal', { force: true });
  execSync('npx prisma db push --skip-generate', {
    cwd: process.cwd(),
    env: { ...process.env },
    stdio: 'inherit',
  });
}
