import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../../..");

function readText(path) {
  return readFileSync(resolve(root, path), "utf8");
}

test("web toaster keeps useToast and renders ToastNotification", () => {
  const toaster = readText("src/components/ui/toaster.jsx");
  const app = readText("src/App.jsx");
  assert.match(toaster, /useToast/);
  assert.match(toaster, /ToastNotification/);
  assert.match(toaster, /resolveToastVariant/);
  assert.match(app, /<Toaster \/>/);
});

test("toast notification uses Stage chrome and lucide icons", () => {
  const source = readText("src/components/ui/toast-notification.jsx");
  assert.match(source, /from "lucide-react"/);
  assert.match(source, /font-heading/);
  assert.match(source, /stage-toast-enter/);
  assert.match(source, /variant === "destructive"/);
  assert.doesNotMatch(source, /framecn/);
  assert.doesNotMatch(source, /geist-sans/);
});

test("settings can fire the existing toast() system", () => {
  const settings = readText("src/components/NotificationSettings.jsx");
  const types = readText("src/lib/notificationTypes.js");
  assert.match(settings, /toast\(\{ title: row.title/);
  assert.match(settings, /Send all test toasts/);
  assert.match(types, /TEST_TOAST_SAMPLES/);
});
