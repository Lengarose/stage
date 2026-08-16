const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { ensureUploadsDir } = require('../../constants/paths');
const { get } = require('../../constants/env');
const { ok, fail } = require('./helpers');
const {
  MAX_SHOWCASE_VIDEO_BYTES,
  MAX_SHOWCASE_VIDEO_MB,
  MAX_IMAGE_UPLOAD_BYTES,
  MAX_IMAGE_UPLOAD_MB,
  uploadTooLargeError,
} = require('../services/showcaseVideoLimits');

const router = express.Router();

const storage = multer.diskStorage({
  destination: ensureUploadsDir(),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '') || '.bin';
    cb(null, `${uuidv4()}${ext}`);
  },
});

const showcaseUpload = multer({
  storage,
  limits: { fileSize: MAX_SHOWCASE_VIDEO_BYTES },
});

const imageUpload = multer({
  storage,
  limits: { fileSize: MAX_IMAGE_UPLOAD_BYTES },
});

function respondUpload(req, res) {
  if (!req.file) return fail(res, 400, 'No file uploaded');
  const SERVER_URL = get('SERVER_URL') || 'http://localhost:8080';
  const file_url = `${SERVER_URL}/uploads/${req.file.filename}`;
  return ok(res, { file_url, url: file_url, media_url: file_url });
}

function handleUpload(uploadMw, maxMb) {
  return (req, res) => {
    uploadMw.single('file')(req, res, (err) => {
      if (err) {
        const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
        const message = err.code === 'LIMIT_FILE_SIZE'
          ? uploadTooLargeError(maxMb)
          : err.message || 'Upload failed';
        return fail(res, status, message);
      }
      return respondUpload(req, res);
    });
  };
}

router.post('/chat', handleUpload(imageUpload, MAX_IMAGE_UPLOAD_MB));
router.post('/', handleUpload(showcaseUpload, MAX_SHOWCASE_VIDEO_MB));
router.post('/avatar', handleUpload(imageUpload, MAX_IMAGE_UPLOAD_MB));

module.exports = router;
