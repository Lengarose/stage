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

/**
 * Pick the socket.io server URL at runtime.
 * - Local dev (localhost:5173): localhost:3001 unless VITE_SOCKET_URL overrides.
 * - Production HTTPS: never use a baked-in localhost URL; default to Render.
 */
export function resolveSocketUrl(configuredUrl) {
  const configured = typeof configuredUrl === 'string' ? configuredUrl.trim() : '';
  const isBrowser = typeof window !== 'undefined';
  const hostname = isBrowser ? window.location.hostname : '';
  const onLocalDev = isBrowser && isLocalHost(hostname);
  const onSecurePage = isBrowser && window.location.protocol === 'https:';

  if (configured && !(onSecurePage && pointsToLocalhost(configured))) {
    return normalizeSocketScheme(configured, onSecurePage);
  }

  if (onLocalDev) {
    return configured || LOCAL_DEV_SOCKET_URL;
  }

  return PRODUCTION_SOCKET_URL;
}
