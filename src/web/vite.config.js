import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import istanbul from 'vite-plugin-istanbul';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    istanbul({
      include: 'src/*',
      exclude: ['node_modules', 'test/'],
      extension: ['.js', '.jsx', '.ts', '.tsx'],
      requireEnv: false,
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
    coverage: {
      include: ['src/**/*.jsx', 'src/**/*.js'],
      exclude: ['src/setupTests.js', 'src/**/__tests__/**'],
      reporter: ['text', 'json', 'html'],
    },
    // Enable coverage collection for LOC tracking
    reporters: ['default'],
    onConsoleLog(log, _type) {
      // Suppress noisy logs during test runs
      if (log.includes('[TimelineEditor] [TimelineScroll]')) return false;
      return true;
    },
  },
  build: {
    assetsDir: 'ui_assets',
  },
})
