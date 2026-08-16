const express = require('express');
const router = express.Router();
const { buildDesk } = require('../services/newsDeskService');

router.get('/:section', async (req, res) => {
  try {
    res.json(await buildDesk(req.params.section));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
