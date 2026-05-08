const express = require('express');
const router = express.Router();
const LandingConfig = require('../models/landingConfigModel');

router.get('/', async (req, res) => {
  try {
    const rows = await new LandingConfig().selectAll(1);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const rows = await new LandingConfig().selectOne(req.params.id);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const cfg = new LandingConfig(req.body);
    await cfg.create();
    const created = await cfg.selectOne(cfg.id);
    res.status(201).json(created[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await new LandingConfig().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const cfg = new LandingConfig({ ...existing[0], ...req.body });
    await cfg.update(id);
    const updated = await cfg.selectOne(id);
    res.json(updated[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await new LandingConfig().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    await new LandingConfig().delete(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
