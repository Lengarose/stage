import assert from "node:assert/strict";
import test from "node:test";
import { PAGE_GUIDE_STEPS_EN } from "../pageWalkthroughCopy.js";
import { getCoreTranslations } from "../../translations/coreTranslations.js";

test("every English page guide is a full path, not three lines", () => {
  const keys = Object.keys(PAGE_GUIDE_STEPS_EN);
  assert.ok(keys.length > 20);
  for (const key of keys) {
    assert.ok(PAGE_GUIDE_STEPS_EN[key].length >= 6, `${key} needs a full path`);
  }
});

test("short translated guides fall back to the English path", () => {
  const fr = getCoreTranslations("fr");
  assert.ok(fr.walkthrough.inbox.steps.length >= 6);
  assert.match(fr.walkthrough.inbox.steps.join(" "), /Inbox/);
});
