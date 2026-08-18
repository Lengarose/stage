import assert from "node:assert/strict";
import test from "node:test";
import {
  isChannelCategoryOn,
  isNotificationEnabled,
  setChannelCategory,
} from "../notificationTypes.js";
import { isPhoneOrPwa } from "../deviceSurface.js";

test("legacy flat settings apply until a channel is customized", () => {
  assert.equal(isChannelCategoryOn({ messages: false }, "web", "messages"), false);
  assert.equal(isChannelCategoryOn({ messages: false }, "email", "messages"), false);
  assert.equal(isNotificationEnabled("message", { messages: false }, "mobile"), false);
});

test("materialize then toggling email does not turn off web", () => {
  const next = setChannelCategory({ messages: true }, "email", "messages", false);
  assert.equal(next.email.messages, false);
  assert.equal(next.web.messages, true);
  assert.equal(next.mobile.messages, true);
});

test("isPhoneOrPwa treats standalone PWA and phone UA as phone surfaces", () => {
  assert.equal(isPhoneOrPwa({
    innerWidth: 1280,
    matchMedia: () => ({ matches: true }),
    navigator: { userAgent: "Mozilla/5.0", standalone: false },
  }), true);
  assert.equal(isPhoneOrPwa({
    innerWidth: 1280,
    matchMedia: () => ({ matches: false }),
    navigator: { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", standalone: false },
  }), true);
  assert.equal(isPhoneOrPwa({
    innerWidth: 1280,
    matchMedia: () => ({ matches: false }),
    navigator: { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", standalone: false },
  }), false);
});
