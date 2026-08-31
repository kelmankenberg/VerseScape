import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

const root = import.meta.dirname;

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(root, 'packages/shared/src'),
      '@main': resolve(root, 'src/main'),
      '@renderer': resolve(root, 'src/renderer'),
    },
  },
  test: {
    environment: 'node',
    include: ['packages/**/*.test.ts', 'src/**/*.test.ts', 'tests/unit/**/*.test.ts'],
  },
});
