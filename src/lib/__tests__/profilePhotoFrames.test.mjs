import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../../..");

function readRepoFile(path) {
  return readFileSync(resolve(root, path), "utf8");
}

test("player and club profile photo frames use parallelogram card shapes", () => {
  const playerFrame = readRepoFile("src/components/profile/gamer/GamerProfileUI.jsx");
  const clubFrame = readRepoFile("src/components/profile/gamer/GamerClubCard.jsx");

  assert.match(playerFrame, /w-\[168px\] sm:w-\[208px\] aspect-\[4\/5\][\s\S]{0,260}\[clip-path:polygon\(12%_0,100%_0,88%_100%,0_100%\)\]/);
  assert.match(clubFrame, /w-\[168px\] sm:w-\[208px\] aspect-\[4\/5\][\s\S]{0,260}\[clip-path:polygon\(12%_0,100%_0,88%_100%,0_100%\)\]/);
  assert.match(playerFrame, /inline-flex min-w-\[84px\][\s\S]{0,260}border-cyan-200\/45/);
  assert.match(playerFrame, /text-amber-200\/30[\s\S]{0,140}\{resolvedShirtNumber\}/);
  assert.match(playerFrame, />POS<\/span>/);
  assert.match(playerFrame, /\{position\}/);
  assert.doesNotMatch(playerFrame, /Kit No\./);
  assert.doesNotMatch(playerFrame, /aspect-\[4\/5\] rounded-2xl/);
  assert.doesNotMatch(clubFrame, /aspect-\[4\/5\] rounded-2xl/);
});

test("profile photo editing uses the same player and club card previews", () => {
  const shell = readRepoFile("src/components/profile/ProfileEditShell.jsx");
  const editor = readRepoFile("src/components/ImagePositionEditor.jsx");

  assert.match(shell, /photoPreviewPlayer/);
  assert.match(shell, /photoPreviewClub/);
  assert.match(shell, /<GamerPlayerPhotoFrame/);
  assert.match(shell, /<GamerClubPhotoFrame/);
  assert.match(editor, /aspect-\[3\/4\][\s\S]{0,160}\[clip-path:polygon\(12%_0,100%_0,88%_100%,0_100%\)\]/);
});
