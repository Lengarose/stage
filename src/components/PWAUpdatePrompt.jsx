import { useEffect, useState } from 'react';

/**
 * PWA update prompt — shows a small toast when a new service-worker build is
 * available. Falls back to silent no-op outside of production / when the SW
 * plugin isn't loaded (e.g. dev mode).
 */
export default function PWAUpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [updateSW, setUpdateSW] = useState(() => () => Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return () => { cancelled = true; };

    let refreshing = false;
    const handleControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      if (cancelled) return;

      const showUpdate = (worker) => {
        if (!worker) return;
        setNeedRefresh(true);
        setUpdateSW(() => async (reloadPage = true) => {
          worker.postMessage({ type: 'SKIP_WAITING' });
          if (reloadPage && !navigator.serviceWorker.controller) window.location.reload();
        });
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
    }).catch(() => {
      // No SW available or registration blocked — ignore.
    });

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      className="fixed z-[120] left-1/2 -translate-x-1/2 bottom-[calc(var(--mobile-tab-h,0px)+var(--safe-bottom,0px)+1rem)] md:bottom-6"
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
        onClick={() => updateSW(true)}
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
        onClick={() => setNeedRefresh(false)}
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
