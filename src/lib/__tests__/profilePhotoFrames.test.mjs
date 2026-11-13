import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../../..");

function readRepoFile(path) {
  return readFileSync(resolve(root, path), "utf8");
}

test("player photos support selectable flat frames while club photos remain circular", () => {
  const playerFrame = readRepoFile("src/components/profile/gamer/GamerProfileUI.jsx");
  const clubFrame = readRepoFile("src/components/profile/gamer/GamerClubCard.jsx");

  assert.match(playerFrame, /w-\[168px\] sm:w-\[208px\]/);
  assert.match(playerFrame, /frame === "circle" \? "aspect-square" : "aspect-\[4\/5\]"/);
  assert.match(playerFrame, /playerPhotoFrame\(player\?\.avatar_frame\)/);
  assert.doesNotMatch(playerFrame, /clip-path:polygon\(12%_0,100%_0,88%_100%,0_100%\)/);
  assert.match(clubFrame, /w-\[184px\] sm:w-\[240px\] aspect-square/);
  assert.match(clubFrame, /aspect-square[\s\S]{0,60}rounded-full/);
  assert.match(clubFrame, /absolute inset-0 rounded-full bg-cover/);
  assert.doesNotMatch(clubFrame, /clip-path:polygon\(12%_0,100%_0,88%_100%,0_100%\)/);
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
  assert.match(editor, /<GamerPlayerPhotoFrame/);
  assert.match(editor, /<GamerClubPhotoFrame/);
  assert.match(editor, /imagePosition=\{position\}/);
  assert.match(editor, /imageZoom=\{zoom\}/);
});
