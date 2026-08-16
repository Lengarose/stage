import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  MAX_SHOWCASE_BYTES,
  MAX_SHOWCASE_MB,
  MAX_SHOWCASE_SECONDS,
  SHOWCASE_UPLOAD_TIMEOUT_MS,
  isShowcaseVideoTypeAllowed,
  validateShowcaseDuration,
  validateShowcaseFileSize,
} from "../showcaseClips.js";

const root = resolve(import.meta.dirname, "../../..");

test("showcase clips are capped at 60 seconds and 20 MB", () => {
  assert.equal(MAX_SHOWCASE_SECONDS, 60);
  assert.equal(MAX_SHOWCASE_MB, 20);
  assert.equal(MAX_SHOWCASE_BYTES, 20 * 1024 * 1024);
  assert.equal(SHOWCASE_UPLOAD_TIMEOUT_MS, 60_000);
});

test("web showcase UI uses the shared 60s / 20MB limits", () => {
  const source = readFileSync(resolve(root, "src/components/scouting/PlayerShowcase.jsx"), "utf8");
  assert.match(source, /MAX_SHOWCASE_SECONDS/);
  assert.match(source, /MAX_SHOWCASE_MB/);
  assert.match(source, /SHOWCASE_UPLOAD_TIMEOUT_MS/);
  assert.match(source, /validateShowcaseFileSize/);
  assert.doesNotMatch(source, /MAX_VIDEO_SECONDS = 20/);
});

test("accepts browser-compatible showcase video types", () => {
  assert.equal(isShowcaseVideoTypeAllowed({ fileName: "clip.mp4" }), true);
  assert.equal(isShowcaseVideoTypeAllowed({ fileName: "clip.MOV" }), true);
  assert.equal(isShowcaseVideoTypeAllowed({ mimeType: "video/webm" }), true);
  assert.equal(isShowcaseVideoTypeAllowed({ fileName: "photo.jpg", mimeType: "image/jpeg" }), false);
});

test("accepts a 60 second clip and rejects anything longer", () => {
  assert.deepEqual(validateShowcaseDuration(60), { ok: true, duration: 60 });
  assert.deepEqual(validateShowcaseDuration(60.01), { ok: false, errorKey: "showcaseVideoTooLong" });
});

test("accepts a 20 MB clip and rejects anything larger", () => {
  assert.deepEqual(validateShowcaseFileSize(MAX_SHOWCASE_BYTES), { ok: true });
  assert.deepEqual(validateShowcaseFileSize(MAX_SHOWCASE_BYTES + 1), { ok: false, errorKey: "showcaseVideoTooLarge" });
});
