const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { EXECUTESQL } = require('../db/database');

const SAFE_KEY = /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/;
const RESERVED = new Set(['limit', 'offset', 'orderBy', 'order_by']);

async function requireAdmin(req, res) {
  const rows = await EXECUTESQL('SELECT id, email, role_id FROM users WHERE id = ? LIMIT 1', [req.user?.id]);
  const user = rows[0];
  if (!user || ![0, 2].includes(Number(user.role_id))) {
    res.status(403).json({ error: 'Admin access required', code: 'admin_required' });
    return null;
  }
  return user;
}

function normalizeValue(column, value, jsonColumns) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (jsonColumns.has(column) && typeof value === 'object') return JSON.stringify(value);
  return value;
}

function pickColumns(body, columns, jsonColumns, { includeId = false } = {}) {
  const out = {};
  for (const column of columns) {
    if (!includeId && column === 'id') continue;
    if (column === 'created_date' || column === 'updated_date') continue;
    if (Object.prototype.hasOwnProperty.call(body, column)) {
      const value = normalizeValue(column, body[column], jsonColumns);
      if (value !== undefined) out[column] = value;
    }
  }
  return out;
}

function buildWhere(query, columns) {
  const where = [];
  const params = [];
  const allowed = new Set(columns);
  for (const [key, rawValue] of Object.entries(query || {})) {
    if (RESERVED.has(key)) continue;
    if (!SAFE_KEY.test(key) || !allowed.has(key)) continue;
    if (rawValue === undefined || rawValue === null || rawValue === '') continue;
    where.push(`\`${key}\` = ?`);
    params.push(String(rawValue));
  }
  return {
    clause: where.length ? `WHERE ${where.join(' AND ')}` : '',
    params,
  };
}

function makeRouter({ table, columns, jsonColumns = [] }) {
  const router = express.Router();
  const allowedColumns = [...new Set(['id', ...columns])];
  const jsonSet = new Set(jsonColumns);
  const hasUpdatedDate = allowedColumns.includes('updated_date');

  router.get('/', async (req, res) => {
    try {
      const { clause, params } = buildWhere(req.query, allowedColumns);
      const limit = Math.max(1, Math.min(Number(req.query?.limit) || 100, 500));
      const rows = await EXECUTESQL(
        `SELECT * FROM \`${table}\` ${clause} ORDER BY created_date DESC LIMIT ?`,
        [...params, limit],
      );
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      const rows = await EXECUTESQL(`SELECT * FROM \`${table}\` WHERE id = ? LIMIT 1`, [req.params.id]);
      if (!rows.length) return res.status(404).json({ error: 'Not found' });
      res.json(rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/', async (req, res) => {
    try {
      if (!await requireAdmin(req, res)) return;
      const body = req.body || {};
      const row = pickColumns({ ...body, id: body.id || uuidv4() }, allowedColumns, jsonSet, { includeId: true });
      if (!row.id) row.id = uuidv4();
      const cols = Object.keys(row);
      const placeholders = cols.map(() => '?').join(', ');
      await EXECUTESQL(
        `INSERT INTO \`${table}\` (${cols.map(col => `\`${col}\``).join(', ')}) VALUES (${placeholders})`,
        cols.map(col => row[col]),
      );
      const created = await EXECUTESQL(`SELECT * FROM \`${table}\` WHERE id = ? LIMIT 1`, [row.id]);
      res.status(201).json(created[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  router.patch('/:id', async (req, res) => {
    try {
      if (!await requireAdmin(req, res)) return;
      const existing = await EXECUTESQL(`SELECT * FROM \`${table}\` WHERE id = ? LIMIT 1`, [req.params.id]);
      if (!existing.length) return res.status(404).json({ error: 'Not found' });
      const row = pickColumns(req.body || {}, allowedColumns, jsonSet);
      const cols = Object.keys(row);
      if (cols.length) {
        const assignments = cols.map(col => `\`${col}\` = ?`);
        if (hasUpdatedDate) assignments.push('updated_date = CURRENT_TIMESTAMP');
        await EXECUTESQL(
          `UPDATE \`${table}\` SET ${assignments.join(', ')} WHERE id = ?`,
          [...cols.map(col => row[col]), req.params.id],
        );
      }
      const updated = await EXECUTESQL(`SELECT * FROM \`${table}\` WHERE id = ? LIMIT 1`, [req.params.id]);
      res.json(updated[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      if (!await requireAdmin(req, res)) return;
      await EXECUTESQL(`DELETE FROM \`${table}\` WHERE id = ?`, [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { makeRouter };
