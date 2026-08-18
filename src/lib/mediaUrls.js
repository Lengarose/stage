export function trimUrl(value) {
  return String(value || '').trim();
}

/** Device or in-memory URIs that only the current client can read. */
export function isDeviceLocalUri(value) {
  const url = trimUrl(value);
  if (!url) return false;
  return /^(file:|content:|ph:|photos:|assets-library:|blob:|data:)/i.test(url);
}

/**
 * URLs that other users (web + mobile) can load.
 * Hosted uploads (`/uploads/...` or absolute http(s)) and provider avatars
 * (Google/Twitch/Kick) are allowed. Local device paths are not.
 */
export function isPersistableMediaUrl(value) {
  const url = trimUrl(value);
  if (!url || isDeviceLocalUri(url)) return false;
  if (url.startsWith('/uploads/')) return true;
  return /^https?:\/\//i.test(url);
}

export function isRemoteHttpUrl(value) {
  return /^https?:\/\//i.test(trimUrl(value));
}
