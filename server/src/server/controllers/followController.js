const express = require('express');
const router  = express.Router();
const Follow  = require('../models/followModel');

// GET /
router.get('/', async (req, res) => {
  try {
    const { follower_email, target_id, target_type, page } = req.query;
    const follow = new Follow();
    let result;
    if (follower_email)        result = await follow.selectByFollower(follower_email);
    else if (target_id && target_type) result = await follow.selectByTarget(target_id, target_type);
    else result = await follow.selectAll(Number(page) || 1);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const follow = new Follow();
    const result = await follow.selectOne(req.params.id);
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
    const follow = new Follow(req.body);
    await follow.create();
    const created = await follow.selectOne(follow.id);
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
    const existing = await new Follow().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const follow = new Follow({ ...existing[0], ...req.body });
    await follow.update(id);
    const updated = await follow.selectOne(id);
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
    const existing = await new Follow().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    await new Follow().delete(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
