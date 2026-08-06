const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

async function closeOpenTenure(presidentId, { endedAt = null, reason = null, query = EXECUTESQL } = {}) {
  if (!presidentId) return;
  await query(
    `UPDATE president_club_history
     SET ended_at = COALESCE(?, NOW()),
         reason = COALESCE(?, reason)
     WHERE president_id = ?
       AND ended_at IS NULL`,
    [endedAt, reason, presidentId]
  );
}

async function openTenure({
  presidentId,
  clubId,
  clubName = null,
  startedAt = null,
  reason = null,
  query = EXECUTESQL,
} = {}) {
  if (!presidentId || !clubId) return null;

  let name = clubName;
  if (!name) {
    const clubs = await query('SELECT name FROM clubs WHERE id = ? LIMIT 1', [clubId]).catch(() => []);
    name = clubs[0]?.name || null;
  }

  const id = uuidv4();
  await query(
    `INSERT INTO president_club_history
       (id, president_id, club_id, club_name, started_at, ended_at, reason, created_date)
     VALUES (?, ?, ?, ?, COALESCE(?, NOW()), NULL, ?, NOW())`,
    [id, presidentId, clubId, name, startedAt, reason]
  );
  return id;
}

/**
 * Close current open tenure (if any) and open a new one when moving to a club.
 * Detach-only passes clubId=null and only closes.
 */
async function recordPresidentClubChange({
  presidentId,
  clubId = null,
  clubName = null,
  reason = null,
  query = EXECUTESQL,
} = {}) {
  if (!presidentId) return;
  await closeOpenTenure(presidentId, { reason, query });
  if (clubId) {
    await openTenure({ presidentId, clubId, clubName, reason, query });
  }
}

/**
 * Repair path for ensure*: keep a single open tenure matching the current club.
 * No-op when already open for the same club.
 */
async function ensureOpenTenureForClub({
  presidentId,
  clubId,
  clubName = null,
  reason = 'President club sync',
  query = EXECUTESQL,
} = {}) {
  if (!presidentId || !clubId) return;
  const open = await query(
    `SELECT id, club_id FROM president_club_history
     WHERE president_id = ? AND ended_at IS NULL
     LIMIT 1`,
    [presidentId]
  ).catch(() => []);
  if (open[0]) {
    if (String(open[0].club_id) === String(clubId)) return;
    await closeOpenTenure(presidentId, { reason, query });
  }
  await openTenure({ presidentId, clubId, clubName, reason, query });
}

async function listHistoryForPresident(presidentId, { query = EXECUTESQL, limit = 50 } = {}) {
  if (!presidentId) return [];
  const rows = await query(
    `SELECT h.*,
            c.logo_url AS club_logo_url,
            c.tag AS club_tag
     FROM president_club_history h
     LEFT JOIN clubs c ON c.id = h.club_id
     WHERE h.president_id = ?
     ORDER BY h.started_at DESC, h.created_date DESC
     LIMIT ?`,
    [presidentId, Math.min(Number(limit) || 50, 100)]
  ).catch(() => []);
  return rows;
}

module.exports = {
  closeOpenTenure,
  openTenure,
  recordPresidentClubChange,
  ensureOpenTenureForClub,
  listHistoryForPresident,
};
