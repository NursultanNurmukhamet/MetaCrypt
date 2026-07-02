import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

/**
 * Vite configuration for MetaCrypt.
 *
 * Key decisions:
 * - `base: './'`  — relative asset URLs so the exact same build works on
 *   GitHub Pages (`/MetaCrypt/`), a custom domain, or opened locally.
 * - `VitePWA`     — makes the app installable and fully usable offline.
 *   Everything is client-side, so once cached the app needs zero network.
 * - No proxy / no server config — there is intentionally NO backend.
 */
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Pre-cache the whole build output: the app must work fully offline.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Metadata libraries are chunky; raise the limit so they get cached.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'MetaCrypt — Metadata Editor & Encryption',
        short_name: 'MetaCrypt',
        description:
          'Open-source client-side metadata editor with encrypted metadata support. Nothing ever leaves your device.',
        theme_color: '#09090b',
        background_color: '#09090b',
        display: 'standalone',
        start_url: '.',
        icons: [
          // SVG icons scale to any size and keep the repo binary-free.
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icons/icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // Keep vendor libraries in separate chunks for better long-term caching.
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          metadata: ['exifreader', 'piexifjs', 'png-chunks-extract', 'png-chunks-encode', 'pako'],
          ui: ['framer-motion', 'lucide-react'],
        },
      },
    },
  },
});
