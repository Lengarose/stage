const express         = require('express');
const router          = express.Router();
const PressConference = require('../models/pressConferenceModel');

// GET /
router.get('/', async (req, res) => {
  try {
    const { match_id, club_id, status, page } = req.query;
    const pc = new PressConference();
    let result;
    if (match_id || club_id || status) {
      result = await pc.selectFiltered({ match_id, club_id, status });
    } else {
      result = await pc.selectAll(Number(page) || 1);
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
    const pc     = new PressConference();
    const result = await pc.selectOne(req.params.id);
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
    const pc = new PressConference(req.body);
    await pc.create();
    const created = await pc.selectOne(pc.id);
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
    const existing = await new PressConference().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const pc = new PressConference({ ...existing[0], ...req.body });
    await pc.update(id);
    const updated = await pc.selectOne(id);
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
    const existing = await new PressConference().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    await new PressConference().delete(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
