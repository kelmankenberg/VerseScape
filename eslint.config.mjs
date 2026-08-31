import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['out/**', 'dist/**', 'release/**', 'node_modules/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  // Architectural boundary: the renderer must never reach into main-process code
  // or Node built-ins. Everything privileged goes through the preload bridge.
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@main/*', '**/main/*'],
              message: 'Renderer must not import main-process code. Use the preload bridge.',
            },
            {
              group: ['electron', 'node:*', 'fs', 'path', 'child_process'],
              message: 'Renderer is sandboxed; no Node access.',
            },
          ],
        },
      ],
    },
  },
);
