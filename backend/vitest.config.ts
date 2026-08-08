import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    globalSetup: './tests/global-setup.ts',
    setupFiles: ['./tests/setup-env.ts'],
    testTimeout: 20000,
    hookTimeout: 60000,
    // Test files share one SQLite file — run them one at a time.
    fileParallelism: false,
  },
});
