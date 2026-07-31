import assert from "node:assert/strict";
import test from "node:test";

import { withTranslationFallback } from "../translationFallback.js";

test("withTranslationFallback replaces raw translation keys with fallback text", () => {
  const tr = (key) => key;
  const tx = withTranslationFallback(tr);

  assert.equal(
    tx("commonPages.icoDurationValue", "{games} games / {days} days", { games: 400, days: 180 }),
    "400 games / 180 days",
  );
});

test("withTranslationFallback keeps real translations from the translation function", () => {
  const tr = () => "Durée";
  const tx = withTranslationFallback(tr);

  assert.equal(tx("commonPages.icoDuration", "Duration"), "Durée");
});
