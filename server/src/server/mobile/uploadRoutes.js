const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { ensureUploadsDir } = require('../../constants/paths');
const { get } = require('../../constants/env');
const { ok, fail } = require('./helpers');

const router = express.Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: ensureUploadsDir(),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '') || '.bin';
      cb(null, `${uuidv4()}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

function respondUpload(req, res) {
  if (!req.file) return fail(res, 400, 'No file uploaded');
  const SERVER_URL = get('SERVER_URL') || 'http://localhost:8080';
  const file_url = `${SERVER_URL}/uploads/${req.file.filename}`;
  return ok(res, { file_url, url: file_url, media_url: file_url });
}

router.post('/chat', upload.single('file'), (req, res) => respondUpload(req, res));
router.post('/', upload.single('file'), (req, res) => respondUpload(req, res));
router.post('/avatar', upload.single('file'), (req, res) => respondUpload(req, res));

module.exports = router;
