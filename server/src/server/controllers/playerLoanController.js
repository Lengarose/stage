const router = require('express').Router();

// Kept as an explicit tombstone for old clients and cached Inbox links.
router.use((_req, res) => res.status(410).json({
  code: 'LOANS_REMOVED',
  error: 'Player loans are no longer available. Use a permanent transfer.',
}));

module.exports = router;
