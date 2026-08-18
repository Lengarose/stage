const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const fs      = require('fs');
const path    = require('path');
const { v4: uuidv4 } = require('uuid');
const { get } = require('../../constants/env');
const { ensureUploadsDir } = require('../../constants/paths');
const {
  MAX_SHOWCASE_VIDEO_BYTES,
  MAX_SHOWCASE_VIDEO_MB,
  maxBytesForUpload,
  megabytesForUpload,
  uploadTooLargeError,
} = require('../services/showcaseVideoLimits');

const ALLOWED_UPLOAD_TYPES = new Map([
  ['image/jpeg', ['.jpg', '.jpeg']],
  ['image/jpg', ['.jpg']],
  ['image/pjpeg', ['.jpg']],
  ['image/png', ['.png']],
  ['image/webp', ['.webp']],
  ['image/gif', ['.gif']],
  ['video/mp4', ['.mp4', '.m4v']],
  ['video/x-m4v', ['.m4v']],
  ['video/webm', ['.webm']],
  ['video/quicktime', ['.mov']],
  ['video/ogg', ['.ogv']],
]);

function normalizeUploadExtension(file) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const allowed = ALLOWED_UPLOAD_TYPES.get(file.mimetype);
  if (!allowed) return null;
  return allowed.includes(ext) ? ext : allowed[0];
}

const storage = multer.diskStorage({
  destination: ensureUploadsDir(),
  filename: (_req, file, cb) => {
    const ext = normalizeUploadExtension(file) || '.bin';
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_SHOWCASE_VIDEO_BYTES },
  fileFilter: (_req, file, cb) => {
    if (normalizeUploadExtension(file)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, WebP, GIF, MP4, M4V, WebM, MOV, and OGV files are allowed'));
    }
  },
});

function removeUploadedFile(file) {
  if (!file?.path) return;
  try { fs.unlinkSync(file.path); } catch { /* already gone */ }
}

router.post('/', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? uploadTooLargeError(MAX_SHOWCASE_VIDEO_MB)
        : err.message || 'Upload failed';
      return res.status(status).json({ error: message });
    }
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const maxBytes = maxBytesForUpload(req.file);
    if (req.file.size > maxBytes) {
      removeUploadedFile(req.file);
      return res.status(413).json({ error: uploadTooLargeError(megabytesForUpload(req.file)) });
    }
    const SERVER_URL = get('SERVER_URL') || 'http://localhost:8080';
    return res.json({ file_url: `${SERVER_URL}/uploads/${req.file.filename}` });
  });
});

module.exports = router;
module.exports._internals = {
  ALLOWED_UPLOAD_TYPES,
  normalizeUploadExtension,
  MAX_SHOWCASE_VIDEO_BYTES,
};
