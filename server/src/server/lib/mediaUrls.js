function trimUrl(value) {
  return String(value || '').trim();
}

/** Device or in-memory URIs that only the current client can read. */
function isDeviceLocalUri(value) {
  const url = trimUrl(value);
  if (!url) return false;
  return /^(file:|content:|ph:|photos:|assets-library:|blob:|data:)/i.test(url);
}

/**
 * URLs that other users (web + mobile) can load.
 * Hosted uploads (`/uploads/...` or absolute http(s)) and provider avatars
 * (Google/Twitch/Kick) are allowed. Local device paths are not.
 */
function isPersistableMediaUrl(value) {
  const url = trimUrl(value);
  if (!url || isDeviceLocalUri(url)) return false;
  if (url.startsWith('/uploads/')) return true;
  return /^https?:\/\//i.test(url);
}

function assertPersistableMediaFields(body, fields) {
  if (!body || typeof body !== 'object') return body;
  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(body, field)) continue;
    const value = body[field];
    if (value == null || value === '') continue;
    if (!isPersistableMediaUrl(value)) {
      const err = new Error(`${field} must be a hosted image URL`);
      err.status = 400;
      throw err;
    }
  }
  return body;
}

module.exports = {
  isDeviceLocalUri,
  isPersistableMediaUrl,
  assertPersistableMediaFields,
};
