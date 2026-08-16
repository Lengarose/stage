import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  isCompetingServiceWorkerUrl,
  isPwaUpdateDismissed,
  dismissPwaUpdate,
  resetPwaUpdateDismissedForTests,
  shouldAllowPwaReload,
} from "../pwaUpdate.js";

const root = resolve(import.meta.dirname, "../../..");

test("PWA reload cooldown blocks a second reload in the same burst", () => {
  const now = 1_000_000;
  assert.equal(shouldAllowPwaReload(now, 0), true);
  assert.equal(shouldAllowPwaReload(now, now - 1_000), false);
  assert.equal(shouldAllowPwaReload(now, now - 30_000), true);
});

test("OneSignal's root worker is treated as competing with the app service worker", () => {
  assert.equal(
    isCompetingServiceWorkerUrl("https://stageleagues.com/OneSignalSDKWorker.js"),
    true,
  );
  assert.equal(isCompetingServiceWorkerUrl("https://stageleagues.com/sw.js"), false);
});

test("PWA prompt does not auto-reload on every controllerchange", () => {
  const source = readFileSync(resolve(root, "src/components/PWAUpdatePrompt.jsx"), "utf8");
  assert.match(source, /userRequestedReload/);
  assert.match(source, /shouldAllowPwaReload/);
  assert.doesNotMatch(
    source,
    /const handleControllerChange = \(\) => \{\s*if \(refreshing\) return;\s*refreshing = true;\s*window\.location\.reload\(\);/,
  );
});

test("Later dismisses the waiting worker for the rest of the session", () => {
  const storage = new Map();
  const session = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
  };
  resetPwaUpdateDismissedForTests();
  assert.equal(isPwaUpdateDismissed(session), false);
  dismissPwaUpdate(session);
  assert.equal(isPwaUpdateDismissed(session), true);
  assert.equal(isPwaUpdateDismissed({ getItem: () => null, setItem() {} }), true);
  resetPwaUpdateDismissedForTests();
});

test("Reload and Later hide the prompt immediately", () => {
  const source = readFileSync(resolve(root, "src/components/PWAUpdatePrompt.jsx"), "utf8");
  assert.match(source, /hidePrompt\(/);
  assert.match(source, /dismissPwaUpdate/);
  assert.match(source, /isPwaUpdateDismissed/);
  assert.match(source, /function reloadNow/);
  assert.match(source, /SKIP_WAITING/);
  assert.match(source, /z-\[220\]/);
  assert.doesNotMatch(
    source,
    /if \(reloadPage && !navigator\.serviceWorker\.controller\) window\.location\.reload\(\)/,
  );
});

test("PWA plugin waits for the Reload button instead of auto-updating", () => {
  const source = readFileSync(resolve(root, "vite.config.js"), "utf8");
  assert.match(source, /registerType:\s*['"]prompt['"]/);
  assert.match(source, /injectRegister:\s*(false|null)/);
});

test("OneSignal reuses the app service worker instead of claiming /", () => {
  const source = readFileSync(resolve(root, "src/lib/oneSignal.js"), "utf8");
  assert.match(source, /serviceWorkerPath:\s*['"]sw\.js['"]/);
  assert.doesNotMatch(source, /OneSignalSDKWorker\.js/);
});
