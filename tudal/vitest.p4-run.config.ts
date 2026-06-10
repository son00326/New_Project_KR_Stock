import { defineConfig } from 'vitest/config';
import path from 'node:path';

// ⚠️ REAL-MONEY / REAL-PROD P4 FULL report run config — NOT part of `npm run test:ci`.
// Globs ONLY the P4 completion driver (*.p4run.test.ts — disjoint from *.smoke / *.full.run /
// *.canary globs) and fail-closes unless P4_FULL_RUN_CONFIRM=1 (see scripts/smoke/setup-env-p4.ts
// + the test's it.runIf gate).
//   cd tudal && P4_FULL_RUN_CONFIRM=1 npx vitest run --config vitest.p4-run.config.ts
// Drives report_batch_job 2026-06 to completion: ~27 remaining tickers × (writer Opus-4.8 +
// critic + conditional revise + Section8 Core-11 vote-pass 11 calls) ≈ ₩15k (P2b measured
// ~₩565/ticker), ~95-120 min sequential. Idempotent/resumable (done jobs skip at LLM 0).
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
    include: ['scripts/smoke/**/*.p4run.test.ts'],
    environment: 'node',
    setupFiles: ['./scripts/smoke/setup-env-p4.ts'],
    testTimeout: 3 * 60 * 60 * 1000, // 3h — 27 × ~3.5min nominal ≈ 95min, retry/slow-API headroom
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
