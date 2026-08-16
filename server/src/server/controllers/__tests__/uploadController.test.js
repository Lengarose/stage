const assert = require('node:assert/strict');
const test = require('node:test');

const { _internals } = require('../uploadController');

function file(originalname, mimetype) {
  return { originalname, mimetype };
}

test('upload accepts browser-compatible showcase video extensions', () => {
  const { normalizeUploadExtension } = _internals;

  assert.equal(normalizeUploadExtension(file('clip.mp4', 'video/mp4')), '.mp4');
  assert.equal(normalizeUploadExtension(file('clip.m4v', 'video/mp4')), '.m4v');
  assert.equal(normalizeUploadExtension(file('clip.m4v', 'video/x-m4v')), '.m4v');
  assert.equal(normalizeUploadExtension(file('clip.webm', 'video/webm')), '.webm');
  assert.equal(normalizeUploadExtension(file('clip.mov', 'video/quicktime')), '.mov');
  assert.equal(normalizeUploadExtension(file('clip.ogv', 'video/ogg')), '.ogv');
});

test('upload allows showcase videos up to 20 MB', () => {
  assert.equal(_internals.MAX_SHOWCASE_VIDEO_BYTES, 20 * 1024 * 1024);
});

test('upload normalizes compatible MIME types and rejects unsupported video containers', () => {
  const { normalizeUploadExtension } = _internals;

  assert.equal(normalizeUploadExtension(file('phone-video', 'video/quicktime')), '.mov');
  assert.equal(normalizeUploadExtension(file('clip.avi', 'video/x-msvideo')), null);
  assert.equal(normalizeUploadExtension(file('clip.mkv', 'video/x-matroska')), null);
});
