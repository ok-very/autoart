import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import path from 'path'

const OUT = path.resolve(__dirname, '../autohelper/autohelper/gui/artists-dist')

export default defineConfig({
  base: '/artists-dashboard/static/',
  plugins: [preact()],
  resolve: {
    alias: {
      'react': 'preact/compat',
      'react-dom': 'preact/compat',
      'react/jsx-runtime': 'preact/jsx-runtime',
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: OUT,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        directory: path.resolve(__dirname, 'directory.html'),
        health: path.resolve(__dirname, 'health.html'),
        recon: path.resolve(__dirname, 'recon.html'),
        settings: path.resolve(__dirname, 'settings.html'),
      },
    },
  },
})
