const assert = require('node:assert/strict');
const test = require('node:test');

const {
  MAX_SHOWCASE_VIDEO_SECONDS,
  MAX_SHOWCASE_VIDEO_MB,
  MAX_SHOWCASE_VIDEO_BYTES,
  MAX_IMAGE_UPLOAD_BYTES,
  maxBytesForUpload,
  megabytesForUpload,
  showcaseDurationError,
  uploadTooLargeError,
} = require('../showcaseVideoLimits');

test('showcase clips are capped at 60 seconds and 20 MB', () => {
  assert.equal(MAX_SHOWCASE_VIDEO_SECONDS, 60);
  assert.equal(MAX_SHOWCASE_VIDEO_MB, 20);
  assert.equal(MAX_SHOWCASE_VIDEO_BYTES, 20 * 1024 * 1024);
});

test('video uploads get the 20 MB showcase cap and images stay at 10 MB', () => {
  assert.equal(maxBytesForUpload({ mimetype: 'video/mp4' }), MAX_SHOWCASE_VIDEO_BYTES);
  assert.equal(megabytesForUpload({ mimetype: 'video/webm' }), 20);
  assert.equal(maxBytesForUpload({ mimetype: 'image/jpeg' }), MAX_IMAGE_UPLOAD_BYTES);
  assert.equal(megabytesForUpload({ mimetype: 'image/png' }), 10);
});

test('error copy matches the configured limits', () => {
  assert.match(showcaseDurationError(), /60 seconds/);
  assert.equal(uploadTooLargeError(20), 'File is too large. Max upload size is 20 MB.');
});
