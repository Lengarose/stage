import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const source = readFileSync(resolve(import.meta.dirname, "../../components/onboarding/TutorialPopup.jsx"), "utf8");

test("web tutorial stays a centered dialog modal on desktop and phone", () => {
  assert.match(source, /<Dialog /);
  assert.match(source, /lg:max-w-4xl/);
  assert.match(source, /hidden lg:flex/);
  assert.match(source, /Each point/);
  assert.doesNotMatch(source, /bottom-0|sheet|drawer/i);
});
