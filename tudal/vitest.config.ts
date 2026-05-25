import { defineConfig } from 'vitest/config';
import path from 'node:path';

// PR4 Step 1.0.3 (B4 + B7 fix omxy R1+R2): test.projects 분리 (Vitest 4 환경 — environmentMatchGlobs removed).
// node project = .test.ts (기존 backend/server-only 로직)
// jsdom project = .test.tsx (PR4 신설 component tests, testing-library)

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      // B16 fix (PR1 omxy R5): Vitest node 환경에서 server-only 즉시 throw 우회.
      // Next.js production build에는 영향 0 (본 alias는 vitest 전용).
      'server-only': path.resolve(__dirname, 'src/test/server-only-empty.ts'),
    },
  },
  test: {
    passWithNoTests: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          include: ['src/**/__tests__/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name: 'jsdom',
          include: ['src/**/__tests__/**/*.test.tsx'],
          environment: 'jsdom',
          setupFiles: ['./src/test/jsdom-setup.ts'],
        },
      },
    ],
  },
});
