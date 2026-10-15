import { build } from 'esbuild';

for (const [entry, out] of [
  ['src/cli.ts', 'dist/bridge.js'],
  ['src/statusline.ts', 'dist/pixel-agency-statusline.js'],
]) {
  await build({
    entryPoints: [entry],
    outfile: out,
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'esm',
    alias: { '@pixel-agency/shared': '../shared/src/index.ts' },
    banner: {
      js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
    },
    logLevel: 'info',
  });
}
