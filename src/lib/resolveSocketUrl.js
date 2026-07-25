/** Render socket service — must use https:// so socket.io upgrades to wss:// (CSP allows wss:, not ws:). */
export const PRODUCTION_SOCKET_URL = 'https://stage-7osn.onrender.com';

export const LOCAL_DEV_SOCKET_URL = 'http://localhost:3001';

function isLocalHost(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function pointsToLocalhost(url) {
  return /localhost|127\.0\.0\.1/i.test(url);
}

/** Upgrade http→https on HTTPS pages so socket.io uses wss:// instead of blocked ws://. */
export function normalizeSocketScheme(url, preferSecure) {
  if (preferSecure && url.startsWith('http://')) {
    return url.replace(/^http:\/\//, 'https://');
  }
  return url;
}

function wantsLocalSocket(env) {
  return String(env?.VITE_USE_LOCAL_SOCKET || '').toLowerCase() === 'true';
}

/**
 * Pick the socket.io server URL at runtime.
 * - Production HTTPS: never use localhost; default Render.
 * - Local Vite dev: default Render too (no local socket-server required).
 *   Set VITE_USE_LOCAL_SOCKET=true + VITE_SOCKET_URL=http://localhost:3001 for local socket dev.
 */
export function resolveSocketUrl(configuredUrl, env = /** @type {any} */ (import.meta).env) {
  const configured = typeof configuredUrl === 'string' ? configuredUrl.trim() : '';
  const isBrowser = typeof window !== 'undefined';
  const hostname = isBrowser ? window.location.hostname : '';
  const onLocalDev = isBrowser && isLocalHost(hostname);
  const onSecurePage = isBrowser && window.location.protocol === 'https:';
  const useLocalSocket = wantsLocalSocket(env);

  if (onSecurePage && configured && pointsToLocalhost(configured)) {
    return PRODUCTION_SOCKET_URL;
  }

  if (onLocalDev && configured && pointsToLocalhost(configured) && !useLocalSocket) {
    return PRODUCTION_SOCKET_URL;
  }

  if (configured) {
    return normalizeSocketScheme(configured, onSecurePage);
  }

  if (onLocalDev && useLocalSocket) {
    return LOCAL_DEV_SOCKET_URL;
  }

  if (onLocalDev) {
    return PRODUCTION_SOCKET_URL;
  }

  return PRODUCTION_SOCKET_URL;
}
