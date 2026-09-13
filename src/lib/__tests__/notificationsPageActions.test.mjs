import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const srcRoot = path.resolve(import.meta.dirname, "../..");

test("Notifications page has no inbox Accept/Decline controls", async () => {
  const source = await readFile(path.join(srcRoot, "pages/Notifications.jsx"), "utf8");
  assert.doesNotMatch(source, /respondInboxMessage/);
  assert.doesNotMatch(source, /handleAction\("accepted"\)/);
});
