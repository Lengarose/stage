const express       = require('express');
const router        = express.Router();
const LifestyleItem = require('../models/lifestyleItemModel');

// GET /
router.get('/', async (req, res) => {
  try {
    const { is_active, page } = req.query;
    const li = new LifestyleItem();
    let result = await li.selectAll(Number(page) || 1);
    if (is_active !== undefined) {
      const active = is_active === 'true' || is_active === '1';
      result = result.filter(r => Boolean(r.is_active) === active);
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
    const li     = new LifestyleItem();
    const result = await li.selectOne(req.params.id);
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
    const li = new LifestyleItem(req.body);
    await li.create();
    const created = await li.selectOne(li.id);
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
    const existing = await new LifestyleItem().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const li = new LifestyleItem({ ...existing[0], ...req.body });
    await li.update(id);
    const updated = await li.selectOne(id);
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
    const existing = await new LifestyleItem().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    await new LifestyleItem().delete(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
