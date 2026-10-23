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

export function listCookieNames(cookieHeader = "") {
  return String(cookieHeader)
    .split(";")
    .map((part) => part.split("=")[0].trim())
    .filter(Boolean);
}

function cookieHostVariants(hostname = "") {
  const host = String(hostname || "").trim();
  if (!host || host === "localhost" || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return [undefined, host || undefined];
  const parts = host.split(".").filter(Boolean);
  const domains = [undefined, host];
  if (parts.length >= 2) domains.push(`.${parts.slice(-2).join(".")}`);
  if (parts.length >= 3) domains.push(`.${host}`);
  return domains;
}

export function expireCookie(name, {
  path = "/",
  domain,
  documentRef,
} = {}) {
  if (!name || !documentRef) return;
  const base = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; path=${path || "/"}`;
  documentRef.cookie = domain ? `${base}; domain=${domain}` : base;
  documentRef.cookie = `${base}; Secure; SameSite=Lax${domain ? `; domain=${domain}` : ""}`;
}

export async function clearWebsiteCookies({
  cookieHeader,
  hostname,
  pathname,
  documentRef,
  cookieStore,
} = {}) {
  const doc = documentRef || (typeof document !== "undefined" ? document : null);
  const loc = typeof location !== "undefined" ? location : null;
  const header = cookieHeader ?? doc?.cookie ?? "";
  const host = hostname ?? loc?.hostname ?? "";
  const currentPath = pathname ?? loc?.pathname ?? "/";
  const names = listCookieNames(header);
  const paths = Array.from(new Set(["/", currentPath || "/"]));
  const domains = cookieHostVariants(host);

  for (const name of names) {
    for (const path of paths) {
      for (const domain of domains) {
        expireCookie(name, { path, domain, documentRef: doc });
      }
    }
  }

  const store = cookieStore || (typeof globalThis !== "undefined" ? globalThis.cookieStore : null);
  if (!store?.getAll) return;
  try {
    const cookies = await store.getAll();
    await Promise.all((cookies || []).map((cookie) => (
      store.delete({
        name: cookie.name,
        ...(cookie.path ? { path: cookie.path } : {}),
        ...(cookie.domain ? { domain: cookie.domain } : {}),
      }).catch(() => {})
    )));
  } catch {
    /* ignore missing Cookie Store support */
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

