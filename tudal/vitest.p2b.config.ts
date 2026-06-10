import { defineConfig } from 'vitest/config';
import path from 'node:path';

// ⚠️ REAL-MONEY / REAL-PROD P2b Section8 live canary config — NOT part of `npm run test:ci`.
// The default vitest.config.ts only globs `src/**/__tests__/**`; vitest.smoke.config.ts globs
// *.smoke.test.ts; vitest.full-run.config.ts globs *.full.run.test.ts. This config globs ONLY
// the P2b canary and fail-closes unless P2B_CANARY_CONFIRM=1 (see scripts/smoke/setup-env-p2b.ts
// + the test's it.runIf gate).
//   cd tudal && P2B_CANARY_CONFIRM=1 npx vitest run --config vitest.p2b.config.ts
// One canary = 1 ticker full report (writer Opus-4.8 + critic + conditional revise) + Section8
// Core-11 vote-pass (11 calls) + commit_persona_eval_cron — ~₩400-1,500, ceiling assert ₩10,000.
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
    include: ['scripts/smoke/**/*.canary.test.ts'],
    environment: 'node',
    setupFiles: ['./scripts/smoke/setup-env-p2b.ts'],
    testTimeout: 30 * 60 * 1000, // writer 8192-token Opus + 11 panel calls + retry worst — generous
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
