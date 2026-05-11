const express = require('express');
const router = express.Router();
const HomePageContent = require('../models/homePageContentModel');

router.get('/', async (req, res) => {
  try {
    const { limit } = req.query;
    const rows = await new HomePageContent().selectAll(limit || 50);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const rows = await new HomePageContent().selectOne(req.params.id);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const hpc = new HomePageContent(req.body);
    await hpc.create();
    const created = await hpc.selectOne(hpc.id);
    res.status(201).json(created[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await new HomePageContent().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const hpc = new HomePageContent({ ...existing[0], ...req.body });
    await hpc.update(id);
    const updated = await hpc.selectOne(id);
    res.json(updated[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await new HomePageContent().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    await new HomePageContent().delete(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
