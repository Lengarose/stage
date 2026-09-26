import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const srcRoot = path.resolve(import.meta.dirname, "../..");

test("Inbox search has a real translation in core match flow copy", async () => {
  const source = await readFile(path.join(srcRoot, "translations/coreTranslations.js"), "utf8");

  assert.match(source, /inboxSearch: "Search"/);
  assert.match(source, /inboxSearch: "Zoeken"/);
});

test("Translation helpers support t(key, fallback) calls", async () => {
  const provider = await readFile(path.join(srcRoot, "lib/TranslationContext.jsx"), "utf8");
  const hook = await readFile(path.join(srcRoot, "hooks/useTranslation.js"), "utf8");

  assert.match(provider, /function normalizeTranslationArgs/);
  assert.match(provider, /typeof paramsOrFallback === "string"/);
  assert.match(provider, /value \|\| fallback \|\| key/);

  assert.match(hook, /function normalizeTranslationArgs/);
  assert.match(hook, /String\(fallback \|\| key \|\| ''\)/);
});
