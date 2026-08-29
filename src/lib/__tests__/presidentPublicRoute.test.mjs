import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../../..");

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8");
}

test("App.jsx does not mount a public President profile page at /presidents/:id", () => {
  const app = read("src/App.jsx");
  assert.doesNotMatch(app, /pages\/PresidentProfile/);
  assert.doesNotMatch(app, /<PresidentProfile\b/);
  assert.doesNotMatch(app, /element=\{<PresidentProfile/);
  assert.ok(
    !existsSync(resolve(root, "src/pages/PresidentProfile.jsx")),
    "src/pages/PresidentProfile.jsx must stay deleted",
  );
  assert.match(app, /path="\/presidents\/:id"/);
  assert.match(app, /PresidentLegacyRedirect/);
  assert.doesNotMatch(app, /GamerPresidentProfileHero/);
});

test("ClubDetail never falls back to a /presidents/ profile URL", () => {
  const detail = read("src/pages/ClubDetail.jsx");
  assert.doesNotMatch(detail, /\/presidents\/\$\{/);
  assert.doesNotMatch(detail, /to=\{`\/presidents\//);
  assert.match(detail, /\/players\/\$\{/);
});

test("admin president transfer view link goes to the player profile", () => {
  const dialog = read("src/components/admin/PresidentTransferDialog.jsx");
  assert.doesNotMatch(dialog, /to=\{`\/presidents\/\$\{/);
  assert.match(dialog, /to=\{`\/players\/\$\{/);
  assert.match(dialog, /stageClient\.presidents\.transfer/);
});

test("Game Day loads fixtures for signed club and presidentClub", () => {
  const gameDay = read("src/pages/GameDay.jsx");
  assert.match(gameDay, /presidentClub/);
  assert.match(gameDay, /const clubIds = \[club\?\.id, player\?\.club_id, presidentClub\?\.id\]/);
});
