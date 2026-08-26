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
  'game-day-configs':             'game_day_config',
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

function hasStagePlus(subscription) {
  return ['stage_plus', 'plus', 'pro', 'elite'].includes(String(subscription || '').toLowerCase());
}

const AUDITED_ENTITY_TYPES = new Set([
  'competition',
  'competition_season',
  'regional_league',
  'regional_league_fixture',
  'regional_league_standing',
  'qualification_entry',
  'game_day_config',
]);

function auditValue(value) {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); } catch { return String(value); }
}

async function getAdminUser(req) {
  const rows = await EXECUTESQL('SELECT id, email, role_id FROM users WHERE id = ? LIMIT 1', [req.user?.id || null]);
  const user = rows[0];
  return user && [0, 2].includes(Number(user.role_id)) ? user : null;
}

async function auditLeagueEntity(req, action, entityType, id, before, after, reason) {
  if (!AUDITED_ENTITY_TYPES.has(entityType)) return;
  const admin = await getAdminUser(req).catch(() => null);
  if (!admin) return;
  await EXECUTESQL(
    `INSERT INTO admin_audit_log
       (id, admin_user_id, admin_email, action, entity_type, entity_id, entity_name, old_value, new_value, reason, created_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      uuidv4(),
      admin.id,
      admin.email,
      action,
      entityType,
      id || null,
      after?.name || before?.name || after?.competition_name || before?.competition_name || after?.league_name || before?.league_name || entityType,
      auditValue(before),
      auditValue(after),
      reason || null,
    ],
  ).catch((err) => console.error('[leagueEntity audit]', err.message));
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
      wheres.push(`JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.${k}')) = ?`);
      vals.push(String(v));
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
      if (entityType === 'game_day_config') {
        const admin = await getAdminUser(req).catch(() => null);
        if (!admin) return res.status(403).json({ error: 'Admin access required.' });
      }
      if (entityType === 'season_registration') {
        const userRows = await EXECUTESQL('SELECT id, email, role_id FROM users WHERE id = ? LIMIT 1', [req.user?.id || null]);
        const user = userRows[0] || null;
        const isAdmin = [0, 2].includes(Number(user?.role_id));
        if (!isAdmin) {
          const playerRows = await EXECUTESQL(
            'SELECT id, subscription FROM players WHERE user_id = ? OR LOWER(TRIM(email)) = LOWER(TRIM(?)) ORDER BY user_id = ? DESC, updated_date DESC LIMIT 1',
            [req.user?.id || null, user?.email || '', req.user?.id || null]
          );
          if (!hasStagePlus(playerRows[0]?.subscription)) {
            return res.status(403).json({ error: 'STAGE Plus is required to enter STAGE regional leagues and official competitions.' });
          }
        }
      }
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
      const createdRow = parseRow(created);
      await auditLeagueEntity(req, `create_${entityType}`, entityType, id, null, createdRow, body.reason);
      res.status(201).json(createdRow);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH /:id
  router.patch('/:id', async (req, res) => {
    try {
      if (entityType === 'game_day_config') {
        const admin = await getAdminUser(req).catch(() => null);
        if (!admin) return res.status(403).json({ error: 'Admin access required.' });
      }
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
      const updatedRow = parseRow(updated);
      await auditLeagueEntity(req, `update_${entityType}`, entityType, id, current, updatedRow, body.reason);
      res.json(updatedRow);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /:id
  router.delete('/:id', async (req, res) => {
    try {
      if (entityType === 'game_day_config') {
        const admin = await getAdminUser(req).catch(() => null);
        if (!admin) return res.status(403).json({ error: 'Admin access required.' });
      }
      const existing = await EXECUTESQL(`SELECT * FROM \`${TABLE}\` WHERE id = ? AND entity_type = ? LIMIT 1`, [req.params.id, entityType]);
      const before = existing.length ? parseRow(existing[0]) : null;
      await EXECUTESQL(`DELETE FROM \`${TABLE}\` WHERE id = ? AND entity_type = ?`, [req.params.id, entityType]);
      await auditLeagueEntity(req, `delete_${entityType}`, entityType, req.params.id, before, null, req.body?.reason);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { makeRouter, ROUTE_TO_TYPE };
