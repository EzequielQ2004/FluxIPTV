import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['hls.js', 'dashjs'],
        },
      },
    },
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Flux IPTV',
        short_name: 'Flux',
        description: 'Reproductor IPTV con listas M3U',
        lang: 'es',
        theme_color: '#0f0f1a',
        background_color: '#0f0f1a',
        display: 'standalone',
        orientation: 'any',
        scope: '/',
        start_url: '/',
        categories: ['entertainment', 'multimedia'],
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ],
        screenshots: [
          { src: '/screenshot-1.png', sizes: '1365x766', type: 'image/png', form_factor: 'wide', label: 'Reproduciendo canal' },
          { src: '/screenshot-2.png', sizes: '1357x636', type: 'image/png', form_factor: 'wide', label: 'Lista de canales' },
          { src: '/screenshot-3.png', sizes: '1365x634', type: 'image/png', form_factor: 'wide', label: 'Configuración' },
          { src: '/screenshot-4.png', sizes: '1365x634', type: 'image/png', form_factor: 'wide', label: 'Cargar lista M3U' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']
      }
    })
  ]
});
