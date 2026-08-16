import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const localApiDefault = 'http://127.0.0.1:8080';
  const proxyTarget = env.VITE_API_PROXY_TARGET || localApiDefault;
  const useLocal = /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(proxyTarget);
  let pwaPlugin = null;

  try {
    const { VitePWA } = await import('vite-plugin-pwa');
    pwaPlugin = VitePWA({
      registerType: 'prompt',
      injectRegister: false,
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
        importScripts: ['https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js'],
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
    });
  } catch {
    // vite-plugin-pwa is optional for local dev/builds. Production installs can
    // still generate the service worker when the package is present.
  }

  return {
    logLevel: 'info',
    build: {
      // Deployed to Gandi via FTP from this folder (renamed from Vite's default `dist`).
      outDir: 'build',
    },
    resolve: {
      // Keep a single React instance across Vite dep re-optimizations (avoids
      // "Cannot read properties of null (reading 'useContext')" after HMR churn).
      dedupe: ['react', 'react-dom'],
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-router-dom', 'react-simple-maps'],
    },
    server: {
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          secure: !useLocal,
        },
        '/uploads': {
          target: proxyTarget,
          changeOrigin: true,
          secure: !useLocal,
        },
      },
    },
    plugins: [
      react(),
      pwaPlugin,
      {
        name: 'log-api-proxy-target',
        configureServer() {
          console.log(`[vite] /api/* → ${proxyTarget}`);
        },
      },
    ].filter(Boolean),
  };
});
