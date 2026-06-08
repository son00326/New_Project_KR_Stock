import { defineConfig } from 'vitest/config';
import path from 'node:path';

// ⚠️ REAL-MONEY / REAL-PROD smoke harness config — NOT part of `npm run test:ci`.
// The default vitest.config.ts only globs `src/**/__tests__/**` so these scripts/ files
// never run in CI. This config is invoked manually & intentionally:
//   P3_SMOKE_CONFIRM=1 npx vitest run --config vitest.smoke.config.ts
// Each *.smoke.test.ts here additionally fail-closes unless P3_SMOKE_CONFIRM=1, so an
// accidental run with this config still spends $0.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      // mirror vitest.config.ts: server-only throws in node env; alias to empty for the harness.
      'server-only': path.resolve(__dirname, 'src/test/server-only-empty.ts'),
    },
  },
  test: {
    passWithNoTests: false,
    include: ['scripts/smoke/**/*.smoke.test.ts'],
    environment: 'node',
    setupFiles: ['./scripts/smoke/setup-env.ts'],
    testTimeout: 180_000, // real AI panel (11 calls) — generous ceiling
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
