import { resolve } from 'node:path';
import { builtinModules } from 'node:module';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import pkg from './package.json';

const shared = resolve(__dirname, 'packages/shared/src');

/**
 * Anything that must be `require`d at runtime rather than bundled: Electron
 * itself, Node builtins, and production dependencies (native modules such as
 * better-sqlite3 cannot be bundled).
 */
const runtimeExternals = [
  'electron',
  ...builtinModules,
  ...builtinModules.map((name) => `node:${name}`),
  ...Object.keys(pkg.dependencies ?? {}),
];

export default defineConfig({
  main: {
    resolve: {
      alias: {
        '@shared': shared,
        '@main': resolve(__dirname, 'src/main'),
      },
    },
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/main/index.ts') },
        external: runtimeExternals,
        output: { format: 'cjs', entryFileNames: '[name].js' },
      },
    },
  },
  // Preload is fully bundled and emitted as CommonJS: `sandbox: true` forbids
  // both requiring arbitrary node modules and ESM preload scripts.
  preload: {
    resolve: { alias: { '@shared': shared } },
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/preload/index.ts') },
        external: ['electron'],
        output: { format: 'cjs', entryFileNames: '[name].js' },
      },
    },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    resolve: {
      alias: {
        '@shared': shared,
        '@renderer': resolve(__dirname, 'src/renderer'),
      },
    },
    plugins: [react()],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/renderer/index.html') },
      },
    },
  },
});
