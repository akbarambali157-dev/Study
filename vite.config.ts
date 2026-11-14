import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  // Relative base so the same build works on GitHub Pages, Netlify and Vercel.
  base: './',
  define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.1.0'), __BUILD_ID__: JSON.stringify(process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local') },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'studyhub-icon.svg', 'apple-touch-icon.png', 'pwa-192.png', 'pwa-512.png'],
      manifest: {
        name: 'OOU Study Hub',
        short_name: 'Study Hub',
        description:
          'Turn lecture PDFs into short notes, key points, flashcards and tests.',
        theme_color: '#17134b',
        background_color: '#090d1d',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          { src: 'studyhub-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,mjs}'],
        globIgnores: [
          '**/pdf.worker*.mjs',
          // Keep the dashboard/app shell offline-ready. Optional routes and
          // heavy engines are cached on first use instead of every install.
          // Keep local study screens and their shared dependencies offline-ready.
          // Only the large direct-provider SDK and PDF engine are deferred to first use.
          '**/assets/{sdk,pdf}-*.js',
        ],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /\.worker.*\.mjs$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'pdf-worker',
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: /\/assets\/.*\.(?:js|mjs)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'studyhub-feature-code',
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
})
