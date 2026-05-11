const express  = require('express');
const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

// Table name used by all competition/league entities (single flexible store).
const TABLE = 'league_entities';

// Route segment → entity_type value stored in DB.
const ROUTE_TO_TYPE = {
  'competitions':                 'competition',
  'competition-seasons':          'competition_season',
  'competition-fixtures':         'competition_fixture',
  'competition-standings':        'competition_standing',
  'regional-leagues':             'regional_league',
  'regional-league-fixtures':     'regional_league_fixture',
  'regional-league-standings':    'regional_league_standing',
  'qualification-entries':        'qualification_entry',
  'ranking-configs':              'ranking_config',
  'season-registrations':         'season_registration',
};

// Fields indexed as real columns (for WHERE filters); everything else in data JSON.
const INDEXED = ['status', 'scheduling_status', 'slug', 'league_id', 'season_id',
                 'competition_id', 'club_id', 'is_active', 'tier', 'division',
                 'region', 'platform', 'season_number'];

function now() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

function serializeVal(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
}

// Parse a stored row back into a plain object the frontend expects.
function parseRow(row) {
  if (!row) return null;
  let data = {};
  try { data = row.data_json ? (typeof row.data_json === 'string' ? JSON.parse(row.data_json) : row.data_json) : {}; } catch {}
  // Merge: indexed columns take precedence (they're always in sync with data_json).
  const out = { ...data, id: row.id, created_date: row.created_date, updated_date: row.updated_date };
  for (const f of INDEXED) {
    if (row[f] !== undefined && row[f] !== null) out[f] = row[f];
  }
  return out;
}

// Extract indexed values from a plain object.
function extractIndexed(obj) {
  const cols = {}, vals = [];
  for (const f of INDEXED) {
    if (obj[f] !== undefined) { cols[f] = obj[f]; }
  }
  return cols;
}

// Build the safe filter WHERE clause from query params.
//
// Strategy:
//   • INDEXED columns + `id` use a direct `\`col\` = ?` comparison (uses indexes,
//     fast path).
//   • Any other column the frontend asks to filter on falls back to
//     `JSON_EXTRACT(data_json, '$.<key>') = ?` so filters on JSON-only fields
//     (e.g. owner_email, club_name) work instead of being SILENTLY DROPPED —
//     which previously caused entities like season_registration to leak rows
//     of OTHER users to the requester when the only filter was owner_email.
//   • Unknown keys are rejected with a strict identifier regex to prevent
//     SQL/JSON-path injection. Reserved query params (limit, orderBy, offset,
//     entity_type) are skipped.
function buildWhere(entityType, queryParams) {
  const wheres = ['entity_type = ?'];
  const vals   = [entityType];
  const FAST   = new Set([...INDEXED, 'id']);
  const RESERVED = new Set(['limit', 'offset', 'orderBy', 'order_by', 'entity_type']);
  const SAFE_KEY = /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/;

  for (const [k, v] of Object.entries(queryParams)) {
    if (RESERVED.has(k)) continue;
    if (!SAFE_KEY.test(k)) continue;
    if (FAST.has(k)) {
      wheres.push(`\`${k}\` = ?`);
      vals.push(v);
    } else {
      wheres.push(`JSON_EXTRACT(data_json, '$.${k}') = ?`);
      vals.push(v);
    }
  }
  return { where: wheres.join(' AND '), vals };
}

function makeRouter(entityType) {
  const router = express.Router();

  // GET / — list/filter
  router.get('/', async (req, res) => {
    try {
      const lim = Math.min(Number(req.query.limit) || 200, 500);
      const { where, vals } = buildWhere(entityType, req.query);
      const rows = await EXECUTESQL(
        `SELECT * FROM \`${TABLE}\` WHERE ${where} ORDER BY created_date DESC LIMIT ?`,
        [...vals, lim]
      );
      res.json(rows.map(parseRow));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /:id
  router.get('/:id', async (req, res) => {
    try {
      const rows = await EXECUTESQL(
        `SELECT * FROM \`${TABLE}\` WHERE id = ? AND entity_type = ? LIMIT 1`,
        [req.params.id, entityType]
      );
      if (!rows.length) return res.status(404).json({ error: 'Not found' });
      res.json(parseRow(rows[0]));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /
  router.post('/', async (req, res) => {
    try {
      const body = req.body || {};
      const id   = body.id || uuidv4();
      const n    = now();
      const indexed = extractIndexed(body);
      const idxCols = Object.keys(indexed);
      const idxVals = idxCols.map(c => serializeVal(indexed[c]));

      const baseCols = ['id', 'entity_type', 'data_json', 'created_date', 'updated_date'];
      const baseVals = [id, entityType, JSON.stringify({ ...body, id }), body.created_date || n, n];

      const allCols = [...baseCols, ...idxCols];
      const allVals = [...baseVals, ...idxVals];

      await EXECUTESQL(
        `INSERT INTO \`${TABLE}\` (${allCols.map(c => `\`${c}\``).join(',')}) VALUES (${allCols.map(() => '?').join(',')})`,
        allVals
      );
      const [created] = await EXECUTESQL(`SELECT * FROM \`${TABLE}\` WHERE id = ? LIMIT 1`, [id]);
      res.status(201).json(parseRow(created));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH /:id
  router.patch('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await EXECUTESQL(`SELECT * FROM \`${TABLE}\` WHERE id = ? LIMIT 1`, [id]);
      if (!existing.length) return res.status(404).json({ error: 'Not found' });

      const body    = req.body || {};
      const current = parseRow(existing[0]);
      const merged  = { ...current, ...body, id };

      const indexed  = extractIndexed(merged);
      const idxCols  = Object.keys(indexed);
      const idxVals  = idxCols.map(c => serializeVal(indexed[c]));

      const setCols = ['data_json = ?', 'updated_date = ?', ...idxCols.map(c => `\`${c}\` = ?`)];
      const setVals = [JSON.stringify(merged), now(), ...idxVals, id];

      await EXECUTESQL(
        `UPDATE \`${TABLE}\` SET ${setCols.join(', ')} WHERE id = ?`,
        setVals
      );
      const [updated] = await EXECUTESQL(`SELECT * FROM \`${TABLE}\` WHERE id = ? LIMIT 1`, [id]);
      res.json(parseRow(updated));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /:id
  router.delete('/:id', async (req, res) => {
    try {
      await EXECUTESQL(`DELETE FROM \`${TABLE}\` WHERE id = ? AND entity_type = ?`, [req.params.id, entityType]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { makeRouter, ROUTE_TO_TYPE };
