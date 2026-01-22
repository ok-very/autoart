import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * INTAKE BUILD TARGET
 * - Deploy output to: https://intake.autoart.work
 * - Must be able to load without the Node backend being up.
 * - Avoid default /api proxying here; intake should either:
 *   (A) be fully static (schema embedded / bundled), OR
 *   (B) talk to a separate always-on endpoint (e.g. edge function) via VITE_INTAKE_API_URL.
 */
export default defineConfig({
    root: path.resolve(__dirname, 'intake'),
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            // Reuse shared UI and logic from the main frontend source tree.
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        port: 5174, // dev: intake
        proxy: {
            '/public': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            }
        }
    },
    build: {
        // Output next to the dashboard dist so deploy pipelines can pick it up separately.
        outDir: path.resolve(__dirname, '../dist-intake'),
        emptyOutDir: true,
        sourcemap: true,
    },
});
