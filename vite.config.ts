import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: {
    // A fixed, uncommon port keeps Studio from colliding with other Vite apps. The API only accepts
    // browser requests from this origin, so fail loudly instead of drifting to another port.
    port: 4320,
    strictPort: true,
    proxy: {
      '/api': 'http://127.0.0.1:4319',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './tests/frontend/setup.ts',
    css: true,
  },
});
