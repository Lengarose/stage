'use strict';

const router = require('express').Router();
router.get('/:playerId', async (req, res) => {
  try {
    res.json(await require('../services/cardProgressionService').read(req.params.playerId));
  } catch (e) {
    res.status(e.status || 500).json({
      error: e.message
    });
  }
});
module.exports = router;
