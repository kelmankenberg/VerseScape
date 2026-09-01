import { build } from 'esbuild';

/**
 * Bundles the resource compiler so it can run under Electron's Node
 * (`ELECTRON_RUN_AS_NODE=1`), which is the only interpreter whose
 * better-sqlite3 ABI matches the app's (D-28).
 */
await build({
  entryPoints: ['packages/resource-compiler/src/cli.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['better-sqlite3'],
  outfile: 'packages/resource-compiler/dist/cli.cjs',
  logLevel: 'warning',
  alias: { '@shared': './packages/shared/src' },
});
