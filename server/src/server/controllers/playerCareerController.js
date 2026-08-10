const express = require('express');
const router = express.Router();
const { getPlayerCareerSummary } = require('../services/playerCareerService');

router.get('/:playerId', async (req, res) => {
  try {
    const summary = await getPlayerCareerSummary(req.params.playerId);
    res.json(summary);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
