import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: __dirname,
  base: './',
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
  },
  server: {
    port: 5174,
    proxy: {
      '/health': 'http://127.0.0.1:8100',
      '/status': 'http://127.0.0.1:8100',
      '/config': 'http://127.0.0.1:8100',
      '/contacts': 'http://127.0.0.1:8100',
      '/api': 'http://127.0.0.1:8100',
    },
  },
});
