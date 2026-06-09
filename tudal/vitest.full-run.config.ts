import { defineConfig } from 'vitest/config';
import path from 'node:path';

// ⚠️ REAL-MONEY / REAL-PROD FULL selection run config — NOT part of `npm run test:ci`.
// The default vitest.config.ts only globs `src/**/__tests__/**`; vitest.smoke.config.ts globs the
// cheap *.smoke.test.ts. This config globs ONLY the full-run driver and fail-closes unless
// P3_FULL_RUN_CONFIRM=1 (see scripts/smoke/setup-env-full.ts + the test's it.runIf gate).
//   cd tudal && P3_FULL_RUN_CONFIRM=1 npx vitest run --config vitest.full-run.config.ts
// A full run drives short + midlong to finalize → ~1650 R1 + R2 + ~150-180 Opus judge calls,
// ~₩2-5만, 60-120 min. Idempotent/resumable (jobs persist; re-run continues).
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
    include: ['scripts/smoke/**/*.full.run.test.ts'],
    environment: 'node',
    setupFiles: ['./scripts/smoke/setup-env-full.ts'],
    testTimeout: 2 * 60 * 60 * 1000, // 2h ceiling — full sequential run (cross-ticker serialized)
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
