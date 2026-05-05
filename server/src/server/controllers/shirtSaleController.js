const express   = require('express');
const router    = express.Router();
const ShirtSale = require('../models/shirtSaleModel');

// GET /
router.get('/', async (req, res) => {
  try {
    const { club_id, player_id, page } = req.query;
    const ss = new ShirtSale();
    let result;
    if (club_id) result = await ss.selectByClub(club_id);
    else result = await ss.selectAll(Number(page) || 1);
    if (player_id && result) result = result.filter(r => r.player_id === player_id);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const ss     = new ShirtSale();
    const result = await ss.selectOne(req.params.id);
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
    const ss = new ShirtSale(req.body);
    await ss.create();
    const created = await ss.selectOne(ss.id);
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
    const existing = await new ShirtSale().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const ss = new ShirtSale({ ...existing[0], ...req.body });
    await ss.update(id);
    const updated = await ss.selectOne(id);
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
    const existing = await new ShirtSale().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    await new ShirtSale().delete(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
