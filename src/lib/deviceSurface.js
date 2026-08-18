const PHONE_UA = /Android|iPhone|iPad|iPod|Mobile/i;

export function isPhoneOrPwa(win = typeof window === "undefined" ? undefined : window) {
  if (!win) return false;
  const nav = win.navigator || {};
  const standalone = Boolean(
    win.matchMedia?.("(display-mode: standalone)")?.matches || nav.standalone === true
  );
  const mobileUa = PHONE_UA.test(String(nav.userAgent || ""));
  const narrow = typeof win.innerWidth === "number" && win.innerWidth < 768;
  const coarseTouch = Boolean(win.matchMedia?.("(pointer: coarse)")?.matches && Number(nav.maxTouchPoints || 0) > 0);
  return standalone || mobileUa || narrow || coarseTouch;
}
