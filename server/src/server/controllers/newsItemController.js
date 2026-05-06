const express  = require('express');
const router   = express.Router();
const NewsItem = require('../models/newsItemModel');

// GET /
router.get('/', async (req, res) => {
  try {
    const { page } = req.query;
    const ni     = new NewsItem();
    const result = await ni.selectAll(Number(page) || 1);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const ni     = new NewsItem();
    const result = await ni.selectOne(req.params.id);
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
    const ni = new NewsItem(req.body);
    await ni.create();
    const created = await ni.selectOne(ni.id);
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
    const existing = await new NewsItem().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const ni = new NewsItem({ ...existing[0], ...req.body });
    await ni.update(id);
    const updated = await ni.selectOne(id);
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
    const existing = await new NewsItem().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    await new NewsItem().delete(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
