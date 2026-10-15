// Bundles the backend (and the reused Pixel Agents server/core modules) into
// dist/server.js. Runtime deps stay external and are installed with npm.
import { build } from 'esbuild';

await build({
  entryPoints: ['src/main.ts'],
  outfile: 'dist/server.js',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  sourcemap: true,
  packages: 'external',
  // The shared contracts are TypeScript source in this monorepo: bundle them.
  alias: { '@pixel-agency/shared': '../shared/src/index.ts' },
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
  logLevel: 'info',
});
