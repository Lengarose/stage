const express = require('express');
const router = express.Router();
const LandingPageContent = require('../models/landingPageContentModel');

router.get('/', async (req, res) => {
  try {
    const { limit } = req.query;
    const rows = await new LandingPageContent().selectAll(limit || 50);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const rows = await new LandingPageContent().selectOne(req.params.id);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const lpc = new LandingPageContent(req.body);
    await lpc.create();
    const created = await lpc.selectOne(lpc.id);
    res.status(201).json(created[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await new LandingPageContent().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const lpc = new LandingPageContent({ ...existing[0], ...req.body });
    await lpc.update(id);
    const updated = await lpc.selectOne(id);
    res.json(updated[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await new LandingPageContent().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    await new LandingPageContent().delete(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
