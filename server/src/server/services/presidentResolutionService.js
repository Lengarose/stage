const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');
const { ensureOpenTenureForClub } = require('./presidentClubHistoryService');

function sameId(left, right) {
  return String(left || '') === String(right || '');
}

/**
 * Ensure a club has a linked presidents row.
 * Creates a stub from president_user_id / owner_email when missing.
 * Keeps clubs.president_id and presidents.club_id in sync.
 */
async function ensurePresidentForClub(club, { query = EXECUTESQL } = {}) {
  if (!club?.id) return null;

  if (club.president_id) {
    const existing = await query('SELECT * FROM presidents WHERE id = ? LIMIT 1', [club.president_id]).catch(() => []);
    if (existing[0]) {
      if (!sameId(existing[0].club_id, club.id)) {
        await query('UPDATE presidents SET club_id = ? WHERE id = ?', [club.id, existing[0].id]).catch(() => {});
        existing[0].club_id = club.id;
      }
      await ensureOpenTenureForClub({
        presidentId: existing[0].id,
        clubId: club.id,
        clubName: club.name || null,
        reason: 'President ensured',
        query,
      }).catch((err) => console.error('[president_club_history] ensure existing:', err.message));
      return existing[0];
    }
  }

  const userId = club.president_user_id || club.user_id || null;
  if (!userId) return null;

  const byUser = await query('SELECT * FROM presidents WHERE user_id = ? LIMIT 1', [userId]).catch(() => []);
  let president = byUser[0] || null;

  if (!president) {
    const id = uuidv4();
    await query(
      `INSERT INTO presidents (
        id, user_id, club_id, email, display_name, role_title, status, avatar_position, avatar_zoom
      ) VALUES (?, ?, ?, ?, ?, 'President', 'active', '50% 50%', 150)`,
      [id, userId, club.id, club.owner_email || null, null]
    );
    const created = await query('SELECT * FROM presidents WHERE id = ? LIMIT 1', [id]);
    president = created[0] || null;
  } else if (!sameId(president.club_id, club.id)) {
    await query('UPDATE presidents SET club_id = ? WHERE id = ?', [club.id, president.id]).catch(() => {});
    president.club_id = club.id;
  }

  if (president?.id && !sameId(club.president_id, president.id)) {
    await query('UPDATE clubs SET president_id = ? WHERE id = ?', [president.id, club.id]).catch(() => {});
    club.president_id = president.id;
  }

  if (president?.id) {
    await ensureOpenTenureForClub({
      presidentId: president.id,
      clubId: club.id,
      clubName: club.name || null,
      reason: 'President ensured',
      query,
    }).catch((err) => console.error('[president_club_history] ensure:', err.message));
  }

  return president;
}

async function resolvePresidentForClubId(clubId, { query = EXECUTESQL, ensure = true } = {}) {
  if (!clubId) return null;
  const clubs = await query('SELECT * FROM clubs WHERE id = ? LIMIT 1', [clubId]).catch(() => []);
  const club = clubs[0];
  if (!club) return null;
  if (ensure) return ensurePresidentForClub(club, { query });
  if (!club.president_id) return null;
  const rows = await query('SELECT * FROM presidents WHERE id = ? LIMIT 1', [club.president_id]).catch(() => []);
  return rows[0] || null;
}

async function resolvePresidentForUserId(userId, { query = EXECUTESQL, ensure = true } = {}) {
  if (!userId) return null;
  const byUser = await query('SELECT * FROM presidents WHERE user_id = ? LIMIT 1', [userId]).catch(() => []);
  if (byUser[0]) return byUser[0];

  const clubs = await query(
    `SELECT * FROM clubs
     WHERE president_user_id = ? OR user_id = ?
     ORDER BY (president_user_id = ?) DESC
     LIMIT 1`,
    [userId, userId, userId]
  ).catch(() => []);
  if (!clubs[0]) return null;
  if (!ensure) {
    if (!clubs[0].president_id) return null;
    const rows = await query('SELECT * FROM presidents WHERE id = ? LIMIT 1', [clubs[0].president_id]).catch(() => []);
    return rows[0] || null;
  }
  return ensurePresidentForClub(clubs[0], { query });
}

async function resolveOfferedByPresidentId({ userId, clubId, query = EXECUTESQL } = {}) {
  if (clubId) {
    const president = await resolvePresidentForClubId(clubId, { query, ensure: true });
    if (president?.id && (!userId || sameId(president.user_id, userId))) return president.id;
  }
  if (userId) {
    const president = await resolvePresidentForUserId(userId, { query, ensure: true });
    return president?.id || null;
  }
  return null;
}

module.exports = {
  ensurePresidentForClub,
  resolvePresidentForClubId,
  resolvePresidentForUserId,
  resolveOfferedByPresidentId,
};
