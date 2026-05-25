import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env.VITE_API_PROXY_TARGET || 'https://stageleagues.com';
  const useLocal = /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(proxyTarget);

  return {
    logLevel: 'info',
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          secure: !useLocal,
        },
      },
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: ['apple-touch-icon.png', 'icons/logo-192.png', 'icons/logo-512.png'],
        devOptions: {
          // Enable SW in dev for easier testing; comment out if it interferes with HMR.
          enabled: false,
        },
        manifest: {
          id: '/',
          name: 'Stage League',
          short_name: 'Stage',
          description: 'Stage League — competitive football gaming community.',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#06091a',
          theme_color: '#06091a',
          icons: [
            { src: '/icons/logo-192.png',          sizes: '192x192', type: 'image/png' },
            { src: '/icons/logo-512.png',          sizes: '512x512', type: 'image/png' },
            { src: '/icons/logo-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // Precache the JS/CSS shell only — large hero images stay in runtime cache.
          globPatterns: ['**/*.{js,css,html,svg,ico,woff,woff2}'],
          // Some imported PNG hero assets in src/assets are 5–12 MB — don't precache.
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
          navigateFallback: '/index.html',
          // Don't precache 'em — could explode the cache size — runtime cache instead.
          navigateFallbackDenylist: [/^\/api\//, /^\/uploads\//],
          cleanupOutdatedCaches: true,
          runtimeCaching: [
            {
              // GET requests to the REST API — fast network with offline fallback.
              urlPattern: ({ url, request }) =>
                request.method === 'GET' && url.pathname.startsWith('/api/stage/'),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'stage-api',
                networkTimeoutSeconds: 6,
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              // Uploaded images (avatars, club logos, banners) — cache-first.
              urlPattern: ({ url, request }) =>
                request.destination === 'image' && url.pathname.startsWith('/uploads/'),
              handler: 'CacheFirst',
              options: {
                cacheName: 'stage-uploads',
                expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              // Remote images (avatars, ui-avatars fallbacks, etc.).
              urlPattern: ({ request }) => request.destination === 'image',
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'stage-images',
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 14 },
              },
            },
            {
              // Google / system fonts.
              urlPattern: ({ url }) =>
                url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
              handler: 'StaleWhileRevalidate',
              options: { cacheName: 'stage-fonts' },
            },
          ],
        },
      }),
    ],
  };
});