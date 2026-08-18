const assert = require('node:assert/strict');
const test = require('node:test');
const { isDeviceLocalUri, isPersistableMediaUrl, assertPersistableMediaFields } = require('../mediaUrls');

test('rejects device-only image URIs that other users cannot load', () => {
  assert.equal(isDeviceLocalUri('file:///var/mobile/photo.jpg'), true);
  assert.equal(isDeviceLocalUri('content://media/external/images/1'), true);
  assert.equal(isDeviceLocalUri('ph://asset-id'), true);
  assert.equal(isDeviceLocalUri('blob:https://stageleagues.com/abc'), true);
  assert.equal(isDeviceLocalUri('https://lh3.googleusercontent.com/a/photo'), false);
});

test('only hosted http(s) and /uploads paths are persistable', () => {
  assert.equal(isPersistableMediaUrl('https://stageleagues.com/uploads/a.jpg'), true);
  assert.equal(isPersistableMediaUrl('/uploads/a.jpg'), true);
  assert.equal(isPersistableMediaUrl('https://lh3.googleusercontent.com/a/oauth'), true);
  assert.equal(isPersistableMediaUrl('file:///tmp/a.jpg'), false);
  assert.equal(isPersistableMediaUrl('content://media/1'), false);
});

test('assertPersistableMediaFields rejects local avatar and banner URLs', () => {
  assert.throws(
    () => assertPersistableMediaFields({ avatar_url: 'file:///tmp/a.jpg' }, ['avatar_url', 'banner_url']),
    { status: 400 },
  );
  assert.doesNotThrow(() => assertPersistableMediaFields(
    { avatar_url: 'https://stageleagues.com/uploads/a.jpg' },
    ['avatar_url', 'banner_url'],
  ));
});
