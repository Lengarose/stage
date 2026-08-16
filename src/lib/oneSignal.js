import OneSignal from 'react-onesignal';

const viteEnv = typeof import.meta !== 'undefined' ? import.meta.env : {};
const ONESIGNAL_APP_ID = '577f63db-851f-491b-8ade-9defb3f569a0';

export function getOneSignalAppId() {
  return String(viteEnv?.VITE_ONESIGNAL_APP_ID || ONESIGNAL_APP_ID).trim();
}

export function isOneSignalConfigured() {
  return Boolean(getOneSignalAppId());
}

let initPromise = null;

export async function initWebOneSignal() {
  if (!isOneSignalConfigured() || typeof window === 'undefined') return false;
  if (initPromise) return initPromise;
  initPromise = OneSignal.init({
    appId: getOneSignalAppId(),
    allowLocalhostAsSecureOrigin: true,
    serviceWorkerPath: 'sw.js',
    serviceWorkerParam: { scope: '/' },
  }).then(() => true).catch(() => {
    initPromise = null;
    return false;
  });
  return initPromise;
}

async function promptWebPushIfNeeded() {
  try {
    const permission = OneSignal.Notifications?.permission;
    if (permission === true) return;
    if (typeof OneSignal.Slidedown?.promptPush === 'function') {
      await OneSignal.Slidedown.promptPush();
    } else if (typeof OneSignal.Notifications?.requestPermission === 'function') {
      await OneSignal.Notifications.requestPermission();
    }
  } catch {
    /* user dismissed or browser blocked */
  }
}

export async function loginWebOneSignal(user) {
  if (!user?.id) return false;
  const ready = await initWebOneSignal();
  if (!ready) return false;
  await OneSignal.login(String(user.id));
  await promptWebPushIfNeeded();
  return true;
}

export async function logoutWebOneSignal() {
  if (!isOneSignalConfigured() || typeof window === 'undefined') return false;
  try {
    await OneSignal.logout();
    return true;
  } catch {
    return false;
  }
}
