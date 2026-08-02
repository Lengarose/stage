import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../../../..");

test("arrange game dialog names club account context as president mode", () => {
  const source = readFileSync(resolve(root, "src/components/schedule/ArrangeGameDialog.jsx"), "utf8");

  assert.match(source, /isPresidentMode/);
  assert.doesNotMatch(source, /isOwnerMode/);
});
