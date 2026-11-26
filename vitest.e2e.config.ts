import { defineConfig } from 'vitest/config';

// Testes E2E: sobem o backend real e usam o PocketBase de dev (ver src/tests/e2e/setup.ts)
export default defineConfig({
  test: {
    include: ['src/tests/e2e/**/*.e2e.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
