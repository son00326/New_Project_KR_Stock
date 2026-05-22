import { defineConfig } from 'vitest/config';
import path from 'node:path';

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
    include: ['src/**/__tests__/**/*.test.ts'],
    environment: 'node',
    passWithNoTests: true,
  },
});
