const express = require('express');
const router = express.Router();
const FaqItem = require('../models/faqItemModel');

router.get('/', async (req, res) => {
  try {
    const rows = await new FaqItem().selectAll(req.query);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const rows = await new FaqItem().selectOne(req.params.id);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const item = new FaqItem(req.body);
    if (!item.question?.trim() || !item.answer?.trim()) {
      return res.status(400).json({ error: 'question and answer are required' });
    }
    item.question = String(item.question).trim();
    item.answer = String(item.answer).trim();
    await item.create();
    const created = await item.selectOne(item.id);
    res.status(201).json(created[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await new FaqItem().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const merged = { ...existing[0], ...req.body };
    if (merged.question != null) merged.question = String(merged.question).trim();
    if (merged.answer != null) merged.answer = String(merged.answer).trim();
    const item = new FaqItem(merged);
    await item.update(id);
    const updated = await item.selectOne(id);
    res.json(updated[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await new FaqItem().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    await new FaqItem().delete(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
