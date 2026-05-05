const express = require('express');
const router  = express.Router();
const Comment = require('../models/commentModel');

// GET /
router.get('/', async (req, res) => {
  try {
    const { post_id, page } = req.query;
    const comment = new Comment();
    let result;
    if (post_id) result = await comment.selectByPost(post_id);
    else result = await comment.selectAll(Number(page) || 1);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const comment = new Comment();
    const result  = await comment.selectOne(req.params.id);
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
    const comment = new Comment(req.body);
    await comment.create();
    const created = await comment.selectOne(comment.id);
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
    const existing = await new Comment().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const comment = new Comment({ ...existing[0], ...req.body });
    await comment.update(id);
    const updated = await comment.selectOne(id);
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
    const existing = await new Comment().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    await new Comment().delete(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
