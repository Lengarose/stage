import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'

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
    ],
  };
});