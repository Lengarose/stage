const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const { v4: uuidv4 } = require('uuid');
const { get } = require('../../constants/env');
const { ensureUploadsDir } = require('../../constants/paths');

const ALLOWED_UPLOAD_TYPES = new Map([
  ['image/jpeg', ['.jpg', '.jpeg']],
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
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (normalizeUploadExtension(file)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, WebP, GIF, MP4, M4V, WebM, MOV, and OGV files are allowed'));
    }
  },
});

router.post('/', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'File is too large. Max upload size is 10 MB.'
        : err.message || 'Upload failed';
      return res.status(status).json({ error: message });
    }
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const SERVER_URL = get('SERVER_URL') || 'http://localhost:8080';
    return res.json({ file_url: `${SERVER_URL}/uploads/${req.file.filename}` });
  });
});

module.exports = router;
module.exports._internals = {
  ALLOWED_UPLOAD_TYPES,
  normalizeUploadExtension,
};
