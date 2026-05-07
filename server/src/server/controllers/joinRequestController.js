const express     = require('express');
const router      = express.Router();
const JoinRequest = require('../models/joinRequestModel');

// GET /
router.get('/', async (req, res) => {
  try {
    const { club_id, player_id, player_email, status, page } = req.query;
    const jr = new JoinRequest();
    let result;
    if (club_id || player_id || player_email || status) {
      result = await jr.selectFiltered({ club_id, player_id, player_email, status });
    } else {
      result = await jr.selectAll(Number(page) || 1);
    }
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const jr     = new JoinRequest();
    const result = await jr.selectOne(req.params.id);
    if (!result.length) return res.status(404).json({ error: 'Not found' });
    res.json(result[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /
router.post('/', async (req, res) => {
  try {
    const { player_id, club_id } = req.body || {};
    if (!player_id || !club_id) {
      return res.status(400).json({ error: 'player_id and club_id are required' });
    }

    const existing = await new JoinRequest().selectFiltered({ player_id, club_id });
    const active = existing.find(
      (r) => !['rejected', 'cancelled', 'withdrawn'].includes(String(r.status || '').toLowerCase())
    );
    if (active) {
      // Idempotent behavior: do not create duplicates for same player+club.
      return res.status(200).json(active);
    }

    const jr = new JoinRequest(req.body);
    await jr.create();
    const created = await jr.selectOne(jr.id);
    res.status(201).json(created[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /:id
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await new JoinRequest().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const jr = new JoinRequest({ ...existing[0], ...req.body });
    await jr.update(id);
    const updated = await jr.selectOne(id);
    res.json(updated[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await new JoinRequest().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    await new JoinRequest().delete(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
