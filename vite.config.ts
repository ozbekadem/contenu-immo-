/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  // « apercu » : un seul fichier HTML autonome (sans service worker) pour la démonstration en ligne.
  const apercu = mode === 'apercu'
  return {
  define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.1.0') },
  ...(apercu && {
    base: './',
    build: {
      outDir: 'dist-apercu',
      assetsInlineLimit: 10_000_000,
      cssCodeSplit: false,
      rollupOptions: { output: { inlineDynamicImports: true } },
    },
  }),
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      disable: apercu,
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Linkimmo',
        short_name: 'Linkimmo',
        description: 'Prospection, relances et fidélisation immobilières',
        lang: 'fr-BE',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F4F5FA',
        theme_color: '#4F46E5',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Appui long sur l'icône (Android) : accès direct aux gestes du quotidien.
        shortcuts: [
          { name: 'Repérer un bien', short_name: 'Repérer', url: '/reperer', icons: [{ src: 'pwa-192.png', sizes: '192x192' }] },
          { name: 'Session d’appels', short_name: 'Appels', url: '/session', icons: [{ src: 'pwa-192.png', sizes: '192x192' }] },
          { name: 'Nouveau contact', short_name: 'Contact', url: '/contacts/nouveau', icons: [{ src: 'pwa-192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        // Fonds de carte déjà vus : gardés sur l'appareil (consultables sans réseau).
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/tile\.openstreetmap\.org\//,
            handler: 'CacheFirst',
            options: { cacheName: 'fonds-carte', expiration: { maxEntries: 800, maxAgeSeconds: 30 * 24 * 3600 }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
  },
}
})
