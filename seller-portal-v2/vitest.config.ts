/**
 * Vitest configuration for seller-portal-v2 (H7).
 *
 * Wires up @vitejs/plugin-react so JSX/TSX compiles, jsdom for DOM-based tests
 * (React Testing Library + auth-slice localStorage tests), and a single setup
 * file that registers @testing-library/jest-dom matchers globally.
 */
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/__tests__/**/*.{test,spec}.{ts,tsx}'],
  },
});
