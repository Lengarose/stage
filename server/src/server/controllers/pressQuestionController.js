const express       = require('express');
const router        = express.Router();
const PressQuestion = require('../models/pressQuestionModel');

// GET /
router.get('/', async (req, res) => {
  try {
    const { category, page } = req.query;
    const pq = new PressQuestion();
    let result;
    if (category) result = await pq.selectByCategory(category);
    else result = await pq.selectAll(Number(page) || 1);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const pq     = new PressQuestion();
    const result = await pq.selectOne(req.params.id);
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
    const pq = new PressQuestion(req.body);
    await pq.create();
    const created = await pq.selectOne(pq.id);
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
    const existing = await new PressQuestion().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const pq = new PressQuestion({ ...existing[0], ...req.body });
    await pq.update(id);
    const updated = await pq.selectOne(id);
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
    const existing = await new PressQuestion().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    await new PressQuestion().delete(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
