import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', '.vite', 'node_modules', 'coverage']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // Allow _ prefixed unused vars (common convention for intentionally unused)
      'no-unused-vars': ['error', { varsIgnorePattern: '^_|^[A-Z_]', argsIgnorePattern: '^_' }],
      // Disable set-state-in-effect - we use intentional state reset patterns on prop changes
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  // Test files get Node.js and Vitest globals
  {
    files: ['**/__tests__/**/*.{js,jsx}', '**/*.test.{js,jsx}'],
    languageOptions: {
      globals: {
        ...globals.node,
        // Vitest globals
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        vi: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
    rules: {
      // Relax unused vars in tests (common for destructuring)
      'no-unused-vars': ['error', { varsIgnorePattern: '^_|^[A-Z_]', argsIgnorePattern: '^_' }],
      // Don't require react-refresh in tests
      'react-refresh/only-export-components': 'off',
    },
  },
  // Config files and E2E tests get Node.js globals
  {
    files: ['*.config.js', 'e2e/**/*.{js,ts}'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
])
