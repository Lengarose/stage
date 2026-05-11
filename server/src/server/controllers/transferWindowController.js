/**
 * REST controller for `transfer_windows`.
 *
 * Note: the *business logic* for opening/closing windows and executing pending
 * transfers lives in the `transferWindowActions` server function
 * (controllers/functionsController.js). That path is transactional and also
 * touches `player_contracts` (status `pending_window` → `pending`).
 *
 * This controller provides plain REST/CRUD on top of the table so the frontend
 * can list/inspect transfer-window history via `stageClient.entities.TransferWindow`.
 */

const express = require('express');
const router = express.Router();
const { EXECUTESQL } = require('../db/database');
const TransferWindowModel = require('../models/transferWindowModel');

router.get('/', async (req, res) => {
  try {
    const { limit, status } = req.query;
    const cap = Math.max(1, Math.min(Number(limit) || 50, 200));
    let sql = 'SELECT * FROM transfer_windows';
    const params = [];
    if (status) {
      sql += ' WHERE status = ?';
      params.push(String(status));
    }
    sql += ' ORDER BY created_date DESC LIMIT ?';
    params.push(cap);
    const rows = await EXECUTESQL(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const rows = await new TransferWindowModel().selectOne(req.params.id);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const win = new TransferWindowModel(req.body);
    await win.create();
    const created = await win.selectOne(win.id);
    res.status(201).json(created[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await new TransferWindowModel().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const win = new TransferWindowModel({ ...existing[0], ...req.body });
    await win.update(id);
    const updated = await win.selectOne(id);
    res.json(updated[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await new TransferWindowModel().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    await new TransferWindowModel().delete(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
