export const SHOWCASE_POSITIONS = ["GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LM", "RM", "LW", "RW", "ST", "CF"];
export const MAX_SHOWCASE_SECONDS = 60;
export const MAX_SHOWCASE_MB = 20;
export const MAX_SHOWCASE_BYTES = MAX_SHOWCASE_MB * 1024 * 1024;
export const SHOWCASE_UPLOAD_TIMEOUT_MS = 60 * 1000;
export const ACCEPTED_VIDEO_EXTENSIONS = [".mp4", ".m4v", ".webm", ".mov", ".ogv"];
export const ACCEPTED_VIDEO_MIME_TYPES = ["video/mp4", "video/x-m4v", "video/webm", "video/quicktime", "video/ogg"];
export const ACCEPTED_VIDEO_INPUT = [...ACCEPTED_VIDEO_MIME_TYPES, ...ACCEPTED_VIDEO_EXTENSIONS].join(",");

export function isShowcaseVideoTypeAllowed({ fileName = "", mimeType = "" } = {}) {
  const name = String(fileName || "").toLowerCase();
  const mime = String(mimeType || "").toLowerCase();
  const extensionAllowed = ACCEPTED_VIDEO_EXTENSIONS.some((ext) => name.endsWith(ext));
  const mimeAllowed = ACCEPTED_VIDEO_MIME_TYPES.includes(mime);
  return extensionAllowed || mimeAllowed;
}

export function validateShowcaseDuration(durationSeconds) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return { ok: false, errorKey: "showcaseVideoInvalid" };
  }
  if (durationSeconds > MAX_SHOWCASE_SECONDS) {
    return { ok: false, errorKey: "showcaseVideoTooLong" };
  }
  return { ok: true, duration: Math.round(durationSeconds * 100) / 100 };
}

export function validateShowcaseFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return { ok: true };
  }
  if (bytes > MAX_SHOWCASE_BYTES) {
    return { ok: false, errorKey: "showcaseVideoTooLarge" };
  }
  return { ok: true };
}
