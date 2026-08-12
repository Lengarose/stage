import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { getPostMediaFrame, getPostImageStyle } from "../feedMedia.js";

const root = process.cwd();

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

const feedFiles = [
  "src/components/PlayerFeed.jsx",
  "src/components/ClubFeed.jsx",
  "src/pages/Social.jsx",
];

test("feed components use server-owned like and comment actions", () => {
  for (const file of feedFiles) {
    const source = read(file);
    assert.match(source, /stageClient\.posts\.likeToggle/);
    assert.doesNotMatch(source, /stageClient\.entities\.Post\.update\([^)]*likes_count/s);
    assert.doesNotMatch(source, /stageClient\.entities\.Post\.update\([^)]*comments_count/s);
    assert.doesNotMatch(source, /stageClient\.entities\.Comment\.create/);
  }
  const modalSource = read("src/components/feed/FeedPostModal.jsx");
  assert.match(modalSource, /stageClient\.comments\.createForPost/);
  assert.doesNotMatch(modalSource, /stageClient\.entities\.Comment\.create/);
});

test("old image posts without framing metadata use safe square defaults", () => {
  assert.deepEqual(getPostMediaFrame({ media_type: "image" }), {
    position: "50% 50%",
    zoom: 100,
    aspect: "square",
  });
  assert.deepEqual(getPostImageStyle({ media_position: "20% 80%", media_zoom: 175 }), {
    objectPosition: "20% 80%",
    transform: "scale(1.75)",
  });
});

test("feed composers are image-only while old video posts still render", () => {
  for (const file of feedFiles) {
    const source = read(file);
    assert.doesNotMatch(source, /accept="image\/\*,video\/\*"/);
    assert.doesNotMatch(source, /accept="video\/\*"/);
    assert.doesNotMatch(source, /uploadMedia\(e,\s*"video"\)/);
    assert.match(source, /media_type === "video"/);
    assert.match(source, /<video/);
  }
});

test("feed image posts pass framing metadata on create and reuse shared media rendering", () => {
  for (const file of feedFiles) {
    const source = read(file);
    assert.match(source, /media_position/);
    assert.match(source, /media_zoom/);
    assert.match(source, /media_aspect/);
    assert.match(source, /FeedPostImageFrame/);
  }
});

test("Social media posts open an in-app post modal that syncs server-owned actions", () => {
  const socialSource = read("src/pages/Social.jsx");
  const modalSource = read("src/components/feed/FeedPostModal.jsx");

  assert.match(socialSource, /const \[expandedPost,\s*setExpandedPost\]/);
  assert.match(socialSource, /<FeedPostModal/);
  assert.match(socialSource, /onOpenPost=\{\(post\) => setExpandedPost\(post\)\}/);
  assert.match(socialSource, /renderContent=\{\(modalPost\) =>/);
  assert.doesNotMatch(socialSource, /window\.open|target="_blank"/);
  assert.match(modalSource, /FeedPostImageFrame[\s\S]*variant="modal"/);
  assert.match(modalSource, /stageClient\.comments\.createForPost/);
  assert.match(modalSource, /onPostUpdated\(result\.post\)/);
});

test("global uploads still allow video for proof and scouting workflows", () => {
  const source = read("server/src/server/controllers/uploadController.js");
  assert.match(source, /'video\/mp4'/);
  assert.match(source, /'video\/webm'/);
  assert.match(source, /'video\/quicktime'/);
});
