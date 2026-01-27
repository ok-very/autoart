import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * POLL BUILD TARGET
 * - Deploy output to: https://poll.autoart.work
 * - Must be able to load without the Node backend being up.
 * - Uses /public/poll/* endpoints (no auth required).
 */
export default defineConfig({
  root: path.resolve(__dirname, 'poll'),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5175,
    proxy: {
      '/public': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: path.resolve(__dirname, '../dist-poll'),
    emptyOutDir: true,
    sourcemap: true,
  },
});
