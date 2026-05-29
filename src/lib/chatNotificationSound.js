// Tiny chat-notification "ding" using the Web Audio API.
// No binary asset to bundle, works in all evergreen browsers + iOS Safari.
//
// Public API:
//   playChatNotificationSound()        // play once (auto-throttled)
//   primeAudioOnUserGesture()          // call from any user gesture once to unblock iOS
//
// iOS / Safari only allows AudioContext to start after a user gesture; we lazily
// create+resume the context the first time the user clicks/taps anywhere via
// primeAudioOnUserGesture, then play silently buffered tones thereafter.

const MIN_INTERVAL_MS = 800;
let audioContext = null;
let lastPlayedAt  = 0;
let primed        = false;

function getAudioContext() {
  if (audioContext) return audioContext;
  const AC = typeof window !== "undefined"
    ? (window.AudioContext || window.webkitAudioContext)
    : null;
  if (!AC) return null;
  try {
    audioContext = new AC();
    return audioContext;
  } catch {
    return null;
  }
}

// Register one-time global pointer/touch listeners that "unlock" Web Audio.
// Safe to call multiple times — only attaches listeners once.
let primingListenersAttached = false;
export function primeAudioOnUserGesture() {
  if (primingListenersAttached || typeof window === "undefined") return;
  primingListenersAttached = true;
  const handler = async () => {
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      if (ctx.state === "suspended") await ctx.resume();
      // Play a 0-volume tick to fully unlock on iOS.
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      g.gain.value = 0;
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.001);
      primed = true;
    } catch { /* swallow — best-effort */ }
    window.removeEventListener("pointerdown", handler);
    window.removeEventListener("keydown", handler);
    window.removeEventListener("touchstart", handler);
  };
  window.addEventListener("pointerdown", handler, { once: true, passive: true });
  window.addEventListener("touchstart",  handler, { once: true, passive: true });
  window.addEventListener("keydown",     handler, { once: true });
}

// Plays a short two-note "ding" — pleasant, not alarming.
// Throttled so a burst of incoming messages doesn't become a buzz.
export function playChatNotificationSound() {
  const now = Date.now();
  if (now - lastPlayedAt < MIN_INTERVAL_MS) return;
  lastPlayedAt = now;

  const ctx = getAudioContext();
  if (!ctx) return;
  // If we haven't been primed yet (no user gesture), bail silently — the next
  // gesture will prime us and subsequent sounds will work.
  if (!primed && ctx.state !== "running") return;

  try {
    const start = ctx.currentTime;
    // Two stacked sine tones (high + perfect-fifth above) with a quick decay.
    playTone(ctx, 880,  start,        0.09, 0.10);  // A5
    playTone(ctx, 1318, start + 0.08, 0.09, 0.08);  // E6
  } catch { /* swallow */ }
}

function playTone(ctx, freq, when, duration, peakGain) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine";
  o.frequency.value = freq;
  // Quick attack, exponential decay (clicky vs. clean tone).
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(peakGain, when + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  o.connect(g).connect(ctx.destination);
  o.start(when);
  o.stop(when + duration + 0.02);
}
