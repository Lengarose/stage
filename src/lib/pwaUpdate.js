export const PWA_RELOAD_COOLDOWN_MS = 20_000;
export const PWA_RELOAD_AT_KEY = "stage-pwa-reload-at";
export const PWA_UPDATE_DISMISSED_KEY = "stage-pwa-update-dismissed";

let dismissedThisRuntime = false;

export function shouldAllowPwaReload(
  now = Date.now(),
  lastReloadAt = 0,
  cooldownMs = PWA_RELOAD_COOLDOWN_MS,
) {
  return !lastReloadAt || now - lastReloadAt >= cooldownMs;
}

export function isCompetingServiceWorkerUrl(scriptURL = "") {
  return String(scriptURL).includes("OneSignalSDKWorker");
}

export function readLastPwaReloadAt(storage = globalThis.sessionStorage) {
  try {
    return Number(storage?.getItem(PWA_RELOAD_AT_KEY) || 0) || 0;
  } catch {
    return 0;
  }
}

export function markPwaReloaded(now = Date.now(), storage = globalThis.sessionStorage) {
  try {
    storage?.setItem(PWA_RELOAD_AT_KEY, String(now));
  } catch {
    /* ignore quota / private mode */
  }
}

export function dismissPwaUpdate(storage = globalThis.sessionStorage) {
  dismissedThisRuntime = true;
  try {
    storage?.setItem(PWA_UPDATE_DISMISSED_KEY, "1");
  } catch {
    /* ignore quota / private mode */
  }
}

export function isPwaUpdateDismissed(storage = globalThis.sessionStorage) {
  if (dismissedThisRuntime) return true;
  try {
    return storage?.getItem(PWA_UPDATE_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function resetPwaUpdateDismissedForTests() {
  dismissedThisRuntime = false;
}

