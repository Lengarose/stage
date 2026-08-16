const MAX_SHOWCASE_VIDEO_SECONDS = 60;
const MAX_SHOWCASE_VIDEO_MB = 20;
const MAX_SHOWCASE_VIDEO_BYTES = MAX_SHOWCASE_VIDEO_MB * 1024 * 1024;
const MAX_IMAGE_UPLOAD_MB = 10;
const MAX_IMAGE_UPLOAD_BYTES = MAX_IMAGE_UPLOAD_MB * 1024 * 1024;

function isVideoUpload(file) {
  return String(file?.mimetype || '').startsWith('video/');
}

function maxBytesForUpload(file) {
  return isVideoUpload(file) ? MAX_SHOWCASE_VIDEO_BYTES : MAX_IMAGE_UPLOAD_BYTES;
}

function megabytesForUpload(file) {
  return isVideoUpload(file) ? MAX_SHOWCASE_VIDEO_MB : MAX_IMAGE_UPLOAD_MB;
}

function showcaseDurationError(seconds = MAX_SHOWCASE_VIDEO_SECONDS) {
  return `Showcase videos must be ${seconds} seconds or shorter`;
}

function uploadTooLargeError(maxMb) {
  return `File is too large. Max upload size is ${maxMb} MB.`;
}

module.exports = {
  MAX_SHOWCASE_VIDEO_SECONDS,
  MAX_SHOWCASE_VIDEO_MB,
  MAX_SHOWCASE_VIDEO_BYTES,
  MAX_IMAGE_UPLOAD_MB,
  MAX_IMAGE_UPLOAD_BYTES,
  isVideoUpload,
  maxBytesForUpload,
  megabytesForUpload,
  showcaseDurationError,
  uploadTooLargeError,
};
