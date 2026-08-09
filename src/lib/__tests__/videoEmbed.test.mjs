import assert from "node:assert/strict";
import test from "node:test";

import { resolveVideoEmbed } from "../videoEmbed.js";

test("a resolved embed carries its own display label, so callers don't re-derive it", () => {
  assert.equal(resolveVideoEmbed("https://youtu.be/dQw4w9WgXcQ").label, "YouTube");
  assert.equal(resolveVideoEmbed("https://drive.google.com/file/d/1AbC_dEfG-hIjK/view").label, "Google Drive");
  assert.equal(resolveVideoEmbed("https://1drv.ms/v/s!AbCdEf").label, "OneDrive");
});

test("http links are refused: an http iframe is blocked as mixed content and would render blank", () => {
  assert.equal(resolveVideoEmbed("http://www.youtube.com/watch?v=dQw4w9WgXcQ"), null);
  assert.equal(resolveVideoEmbed("http://onedrive.live.com/?cid=ABC&id=XYZ"), null);
});

test("a drive path that merely contains a d segment is not mistaken for a file link", () => {
  assert.equal(resolveVideoEmbed("https://drive.google.com/drive/folders/d/1AbC_dEfG-hIjK"), null);
  assert.equal(resolveVideoEmbed("https://drive.google.com/file/d/1AbC_dEfG-hIjK/view").provider, "drive");
});

test("youtube watch links resolve to the embed player", () => {
  const embed = resolveVideoEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.equal(embed.provider, "youtube");
  assert.equal(embed.embedUrl, "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
});

test("youtube short links, /embed, /shorts and /live links all resolve", () => {
  const cases = [
    "https://youtu.be/dQw4w9WgXcQ",
    "https://www.youtube.com/embed/dQw4w9WgXcQ",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    "https://www.youtube.com/live/dQw4w9WgXcQ",
    "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
  ];
  for (const url of cases) {
    const embed = resolveVideoEmbed(url);
    assert.equal(embed?.provider, "youtube", `expected ${url} to resolve`);
    assert.equal(embed.embedUrl, "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", url);
  }
});

test("a youtube link carrying a timestamp or playlist keeps only the video id", () => {
  const embed = resolveVideoEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=PL123");
  assert.equal(embed.embedUrl, "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
});

test("google drive file links resolve to the preview player", () => {
  const embed = resolveVideoEmbed("https://drive.google.com/file/d/1AbC_dEfG-hIjK/view?usp=sharing");
  assert.equal(embed.provider, "drive");
  assert.equal(embed.embedUrl, "https://drive.google.com/file/d/1AbC_dEfG-hIjK/preview");
});

test("google drive open?id= links resolve too", () => {
  const embed = resolveVideoEmbed("https://drive.google.com/open?id=1AbC_dEfG-hIjK");
  assert.equal(embed.provider, "drive");
  assert.equal(embed.embedUrl, "https://drive.google.com/file/d/1AbC_dEfG-hIjK/preview");
});

test("onedrive and sharepoint share links resolve to their embed form", () => {
  const oneDrive = resolveVideoEmbed("https://onedrive.live.com/?cid=ABC&id=XYZ");
  assert.equal(oneDrive?.provider, "onedrive");
  assert.match(oneDrive.embedUrl, /embed/);

  const shortLink = resolveVideoEmbed("https://1drv.ms/v/s!AbCdEf");
  assert.equal(shortLink?.provider, "onedrive");
  assert.match(shortLink.embedUrl, /embed/);
});

test("an unknown video host does not resolve, so the caller falls back to a link", () => {
  assert.equal(resolveVideoEmbed("https://example.com/my-clip.mp4"), null);
  assert.equal(resolveVideoEmbed("https://vimeo.com/123456"), null);
  assert.equal(resolveVideoEmbed("https://twitch.tv/videos/123"), null);
});

test("junk input never throws — it just fails to resolve", () => {
  assert.equal(resolveVideoEmbed(""), null);
  assert.equal(resolveVideoEmbed(null), null);
  assert.equal(resolveVideoEmbed(undefined), null);
  assert.equal(resolveVideoEmbed("not a url at all"), null);
  assert.equal(resolveVideoEmbed("   "), null);
  assert.equal(resolveVideoEmbed(42), null);
});

test("a youtube host with no video id does not resolve", () => {
  assert.equal(resolveVideoEmbed("https://www.youtube.com/"), null);
  assert.equal(resolveVideoEmbed("https://www.youtube.com/results?search_query=foo"), null);
});

test("a drive host with no file id does not resolve", () => {
  assert.equal(resolveVideoEmbed("https://drive.google.com/drive/my-drive"), null);
});

test("non-https schemes are refused even when they look like a known host", () => {
  // Guards against a javascript: payload reaching an iframe src.
  assert.equal(resolveVideoEmbed("javascript:alert(1)//youtube.com/watch?v=abc"), null);
  assert.equal(resolveVideoEmbed("data:text/html,<script>alert(1)</script>"), null);
  assert.equal(resolveVideoEmbed("ftp://youtube.com/watch?v=dQw4w9WgXcQ"), null);
});

test("a lookalike host is not treated as the real one", () => {
  // youtube.com.evil.test must not be accepted as youtube.com.
  assert.equal(resolveVideoEmbed("https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ"), null);
  assert.equal(resolveVideoEmbed("https://notdrive.google.com.evil.test/file/d/abc/view"), null);
});

test("surrounding whitespace is tolerated", () => {
  const embed = resolveVideoEmbed("  https://youtu.be/dQw4w9WgXcQ  ");
  assert.equal(embed?.provider, "youtube");
});
