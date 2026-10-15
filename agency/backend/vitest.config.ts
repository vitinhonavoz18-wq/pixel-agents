import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@pixel-agency/shared': new URL('../shared/src/index.ts', import.meta.url).pathname },
  },
  test: { environment: 'node', include: ['test/**/*.test.ts'], testTimeout: 20_000 },
});
