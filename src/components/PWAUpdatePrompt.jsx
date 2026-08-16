import { useEffect, useRef, useState } from 'react';
import {
  dismissPwaUpdate,
  isCompetingServiceWorkerUrl,
  isPwaUpdateDismissed,
  markPwaReloaded,
  readLastPwaReloadAt,
  shouldAllowPwaReload,
} from '@/lib/pwaUpdate';

/**
 * PWA update prompt — shows a toast when a new service-worker build is waiting.
 * Reload is user-driven. Auto-reload on every controllerchange caused an
 * infinite loop when the app SW and OneSignal both claimed `/`.
 */
export default function PWAUpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const waitingWorker = useRef(null);
  const userRequestedReload = useRef(false);

  useEffect(() => {
    let cancelled = false;
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return () => { cancelled = true; };
    if (isPwaUpdateDismissed()) return () => { cancelled = true; };

    const reloadIfRequested = () => {
      if (!userRequestedReload.current) return;
      if (!shouldAllowPwaReload(Date.now(), readLastPwaReloadAt())) return;
      markPwaReloaded();
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', reloadIfRequested);

    (async () => {
      const registrations = await navigator.serviceWorker.getRegistrations().catch(() => []);
      await Promise.all(registrations.map(async (registration) => {
        const scriptURL = registration.active?.scriptURL
          || registration.waiting?.scriptURL
          || registration.installing?.scriptURL
          || '';
        if (isCompetingServiceWorkerUrl(scriptURL)) {
          await registration.unregister().catch(() => {});
        }
      }));
      if (cancelled || isPwaUpdateDismissed()) return;

      const registration = await navigator.serviceWorker.register('/sw.js').catch(() => null);
      if (cancelled || !registration || isPwaUpdateDismissed()) return;

      const showUpdate = (worker) => {
        if (!worker || isPwaUpdateDismissed()) return;
        waitingWorker.current = worker;
        setNeedRefresh(true);
      };

      if (registration.waiting) showUpdate(registration.waiting);

      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdate(worker);
          }
        });
      });
    })();

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener('controllerchange', reloadIfRequested);
    };
  }, []);

  function hidePrompt() {
    dismissPwaUpdate();
    waitingWorker.current = null;
    setNeedRefresh(false);
  }

  function reloadNow(event) {
    event?.preventDefault();
    event?.stopPropagation();
    const worker = waitingWorker.current;
    hidePrompt();
    userRequestedReload.current = true;
    worker?.postMessage({ type: 'SKIP_WAITING' });
    markPwaReloaded();
    window.location.reload();
  }

  if (!needRefresh || isPwaUpdateDismissed()) return null;

  return (
    <div
      role="status"
      className="fixed z-[220] left-1/2 -translate-x-1/2 top-[calc(var(--safe-top,0px)+0.75rem)] md:top-auto md:bottom-6 pointer-events-auto"
      style={{
        background: 'rgba(8,11,24,0.96)',
        border: '1px solid rgba(0,229,189,0.35)',
        borderRadius: 14,
        padding: '10px 14px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <span
        className="text-[12px] uppercase"
        style={{
          fontFamily: "var(--font-heading,'Barlow Condensed',sans-serif)",
          fontWeight: 600,
          letterSpacing: '0.1em',
          color: 'rgba(255,255,255,0.85)',
        }}
      >
        New version available
      </span>
      <button
        type="button"
        onClick={reloadNow}
        className="text-[11px] uppercase rounded-md px-3 py-1.5"
        style={{
          fontFamily: "var(--font-heading,'Barlow Condensed',sans-serif)",
          fontWeight: 700,
          letterSpacing: '0.12em',
          background: '#00E5BD',
          color: '#06091a',
        }}
      >
        Reload
      </button>
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          hidePrompt();
        }}
        className="text-[10px] uppercase rounded-md px-2 py-1.5"
        style={{
          fontFamily: "var(--font-heading,'Barlow Condensed',sans-serif)",
          fontWeight: 600,
          letterSpacing: '0.1em',
          color: 'rgba(255,255,255,0.55)',
        }}
        aria-label="Dismiss update prompt"
      >
        Later
      </button>
    </div>
  );
}
