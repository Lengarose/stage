const express = require('express');
const router = express.Router();
const { EXECUTESQL } = require('../db/database');
const { HANDLERS } = require('./functionsController');

// Public tournament routes stay unauthenticated, but their implementation
// belongs in a controller so the app bootstrap stays focused on wiring.
router.post('/resolve-entrance-token', async (req, res) => {
  try {
    const result = await HANDLERS.resolveTournamentEntranceToken({ token: req.body?.token });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to resolve entrance token' });
  }
});

router.get('/tournaments/:id', async (req, res) => {
  try {
    const rows = await EXECUTESQL('SELECT * FROM tournaments WHERE id = ? LIMIT 1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to load tournament' });
  }
});

router.get('/tournaments/:id/matches', async (req, res) => {
  try {
    const rows = await EXECUTESQL(
      `SELECT *
         FROM matches
        WHERE tournament_id = ?
        ORDER BY round ASC, group_number ASC, created_date ASC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to load tournament matches' });
  }
});

module.exports = router;
