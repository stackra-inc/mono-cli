/**
 * @fileoverview ESLint configuration for @stackra/mono-cli
 *
 * Uses the shared base config (no React rules — this is a Node CLI).
 *
 * @module @stackra/mono-cli
 * @see https://eslint.org/docs/latest/use/configure/configuration-files
 */

import type { Linter } from 'eslint';
import { baseConfig } from '@stackra/eslint-config';

const config: Linter.Config[] = [
  ...baseConfig,

  {
    ignores: ['dist/**', 'node_modules/**', '*.config.js', '*.config.ts'],
  },

  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];

export default config;
