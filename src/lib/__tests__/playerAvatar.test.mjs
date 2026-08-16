import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { resolvePlayerAvatarUrl } from "../playerAvatar.js";

test("player avatar resolver prefers avatar_url and ignores blanks", () => {
  assert.equal(resolvePlayerAvatarUrl({ avatar_url: "https://cdn.example/a.jpg" }), "https://cdn.example/a.jpg");
  assert.equal(resolvePlayerAvatarUrl({ avatar: "/uploads/b.png" }), "/uploads/b.png");
  assert.equal(resolvePlayerAvatarUrl({ avatar_url: "  " }), "");
  assert.equal(resolvePlayerAvatarUrl(null), "");
});

test("FUT photo frame paints avatars with an img tag so 3D carousels can show them", () => {
  const frame = readFileSync(resolve(import.meta.dirname, "../../components/profile/gamer/GamerProfileUI.jsx"), "utf8");
  const carousel = readFileSync(resolve(import.meta.dirname, "../../components/transfer/TransferPlayerCarousel.jsx"), "utf8");
  assert.match(frame, /<img/);
  assert.match(frame, /resolvePlayerAvatarUrl/);
  assert.match(carousel, /transformStyle:\s*["']flat["']/);
  const vite = readFileSync(resolve(import.meta.dirname, "../../../vite.config.js"), "utf8");
  assert.match(vite, /['"]\/uploads['"]/);
});
