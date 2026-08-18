import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { isNotificationEnabled } from "../notificationTypes.js";

const root = resolve(import.meta.dirname, "../../..");

function readText(path) {
  return readFileSync(resolve(root, path), "utf8");
}

test("Messages setting covers live chat notification type", () => {
  assert.equal(isNotificationEnabled("message", {}), true);
  assert.equal(isNotificationEnabled("message", { messages: true }), true);
  assert.equal(isNotificationEnabled("message", { messages: false }), false);
});

test("web live chat sound and toast follow the Messages switch", () => {
  const source = readText("src/lib/ChatNotificationsContext.jsx");
  const settings = readText("src/lib/notificationTypes.js");

  assert.match(source, /isNotificationEnabled\("message"/);
  assert.match(source, /"web"/);
  assert.match(source, /messagesEnabledRef/);
  assert.match(source, /playChatNotificationSound\(\)/);
  assert.match(source, /toast\(\{/);
  assert.match(source, /if \(alertsOn && !isMuted\)/);
  assert.match(settings, /Direct messages, match chat, and club chat/);
});

test("desktop web settings stay web-only while phone surfaces show email, mobile, and push", () => {
  const source = readText("src/components/NotificationSettings.jsx");
  const surface = readText("src/lib/deviceSurface.js");

  assert.match(source, /Web notifications/);
  assert.match(source, /handleToggle\("web"/);
  assert.match(source, /NOTIFICATION_CHANNELS\.map/);
  assert.match(source, /channel\.key === "push"/);
  assert.match(surface, /display-mode: standalone/);
  const types = readText("src/lib/notificationTypes.js");
  assert.match(types, /Email notifications/);
  assert.match(types, /Mobile notifications/);
  assert.match(types, /Push notifications/);
});
