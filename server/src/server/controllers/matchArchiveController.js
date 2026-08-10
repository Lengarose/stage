const express = require('express');
const router = express.Router();
const { EXECUTESQL } = require('../db/database');

/**
 * The admin match archive: every match ever played, searchable.
 *
 * This is the tool for settling "he said / she said" after the fact, so two things
 * shape it. It never cuts off old matches — a dispute can surface months later, and
 * an archive with a hidden time limit is worse than no archive. And it is strictly
 * admin-only, because it exposes the email addresses of both sides.
 *
 * It is a read over the existing `matches` table. Nothing about how matches are
 * played, submitted or settled changes here.
 */

const MAX_PAGE_SIZE = 200;
const DEFAULT_PAGE_SIZE = 50;

async function requireAdmin(req) {
  const userId = req.user?.id;
  if (!userId) {
    const err = new Error('Not authenticated');
    err.status = 401;
    throw err;
  }
  const rows = await EXECUTESQL(
    'SELECT id, email, role_id FROM users WHERE id = ? LIMIT 1',
    [userId]
  );
  const user = rows[0];
  if (!user || ![0, 2].includes(Number(user.role_id))) {
    const err = new Error('Admin only');
    err.status = 403;
    throw err;
  }
  return user;
}

function clampLimit(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.floor(n));
}

function clampOffset(raw) {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * An admin chasing a complaint has one string — an email, a gamertag, a club name,
 * or the match id from a report — and rarely knows which. So one box searches all
 * of them rather than making them pick a field first.
 */
const SEARCH_COLUMNS = [
  'm.id',
  'm.home_player_email',
  'm.away_player_email',
  'm.home_owner_email',
  'm.away_owner_email',
  'm.home_player_name',
  'm.away_player_name',
  'm.home_club_name',
  'm.away_club_name',
];

function buildFilters(query = {}) {
  const where = [];
  const params = [];

  const search = String(query.search || '').trim();
  if (search) {
    where.push(`(${SEARCH_COLUMNS.map((c) => `${c} LIKE ?`).join(' OR ')})`);
    for (let i = 0; i < SEARCH_COLUMNS.length; i += 1) params.push(`%${search}%`);
  }

  if (query.type) { where.push('m.type = ?'); params.push(String(query.type)); }
  if (query.status) { where.push('m.status = ?'); params.push(String(query.status)); }

  // A match is player-vs-player when it carries player ids rather than club ids.
  if (query.participants === 'player') {
    where.push('(m.home_player_id IS NOT NULL OR m.away_player_id IS NOT NULL)');
  } else if (query.participants === 'club') {
    where.push('(m.home_club_id IS NOT NULL OR m.away_club_id IS NOT NULL)');
  }

  // Range is inclusive of the whole "to" day: an admin typing a date means the day,
  // not midnight at its start.
  if (query.from) { where.push('m.scheduled_date >= ?'); params.push(`${String(query.from).slice(0, 10)} 00:00:00`); }
  if (query.to) { where.push('m.scheduled_date <= ?'); params.push(`${String(query.to).slice(0, 10)} 23:59:59`); }

  if (query.wager === 'yes') where.push('COALESCE(m.wager_stc, 0) > 0');

  return { clause: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

router.get('/', async (req, res) => {
  try {
    await requireAdmin(req);

    const { clause, params } = buildFilters(req.query || {});
    const limit = clampLimit(req.query?.limit);
    const offset = clampOffset(req.query?.offset);

    const countRows = await EXECUTESQL(
      `SELECT COUNT(*) AS total FROM matches m ${clause}`,
      params
    ).catch(() => [{ total: 0 }]);

    // Ordered by scheduled_date with created_date as the tie-break, so matches that
    // were never scheduled still land somewhere sensible instead of at the bottom.
    const matches = await EXECUTESQL(
      `SELECT m.id, m.type, m.mode, m.status,
              m.home_club_id, m.away_club_id, m.home_club_name, m.away_club_name,
              m.home_player_id, m.away_player_id, m.home_player_name, m.away_player_name,
              m.home_player_email, m.away_player_email,
              m.home_owner_email, m.away_owner_email,
              m.home_score, m.away_score,
              m.home_submitted_score, m.away_submitted_score,
              m.scheduled_date, m.first_submission_at, m.updated_date, m.created_date,
              m.wager_stc, m.wager_status,
              m.stats_processed, m.tournament_id, m.competition_context
         FROM matches m
         ${clause}
        ORDER BY COALESCE(m.scheduled_date, m.created_date) DESC, m.created_date DESC
        LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return res.json({
      matches,
      total: Number(countRows[0]?.total || 0),
      limit,
      offset,
    });
  } catch (err) {
    if (!err.status) console.error(err);
    return res.status(err.status || 500).json({ error: err.message });
  }
});

/** A submission column holds JSON; a corrupt one must not sink the whole detail. */
function parseSubmission(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Proof screenshots are scattered across four places: a legacy top-level column,
 * the forfeit column, and one nested inside each side's submission JSON. An admin
 * settling a dispute needs all of them, labelled by whose evidence it is — showing
 * only the first submitter's shot is how you decide a case on half the evidence.
 */
function collectProofs(match, homeSubmission, awaySubmission) {
  const proofs = [];
  const seen = new Set();
  const add = (url, side, label) => {
    const clean = typeof url === 'string' ? url.trim() : '';
    if (!clean || seen.has(clean)) return;
    seen.add(clean);
    proofs.push({ url: clean, side, label });
  };

  add(homeSubmission?.proof_url, 'home', 'home_submission');
  add(awaySubmission?.proof_url, 'away', 'away_submission');
  add(match.proof_url, 'match', 'match_proof');
  add(match.forfeit_proof_url, 'match', 'forfeit_proof');
  return proofs;
}

router.get('/:id', async (req, res) => {
  try {
    await requireAdmin(req);

    const rows = await EXECUTESQL('SELECT m.* FROM matches m WHERE m.id = ? LIMIT 1', [req.params.id]);
    const row = rows[0];
    if (!row) return res.status(404).json({ error: 'Match not found' });

    const homeSubmission = parseSubmission(row.home_submission);
    const awaySubmission = parseSubmission(row.away_submission);

    return res.json({
      match: {
        ...row,
        home_submission: homeSubmission,
        away_submission: awaySubmission,
        // There is no dedicated "played at" column; the first submission is the
        // closest honest marker of when the match was actually played.
        played_at: row.first_submission_at || null,
      },
      proofs: collectProofs(row, homeSubmission, awaySubmission),
    });
  } catch (err) {
    if (!err.status) console.error(err);
    return res.status(err.status || 500).json({ error: err.message });
  }
});

/** A score is a count of goals: a whole number, never negative. */
function parseScore(value, field) {
  const n = Number(value);
  if (value === null || value === undefined || value === '' || !Number.isInteger(n) || n < 0) {
    const err = new Error(`${field} must be a whole score of 0 or more`);
    err.status = 400;
    throw err;
  }
  return n;
}

/**
 * Correct the official score of a played match.
 *
 * Deliberately narrow. It writes the score, stamps who changed it, and records
 * the before/after in the audit log — nothing else.
 *
 * It does NOT settle, reverse or re-settle the wager. Money moves only through an
 * explicit, separate action: a score typed wrong here must not be able to empty a
 * wallet on the way past.
 *
 * It also does NOT recalculate stats or rankings. Those are rebuilt by the
 * existing full recalculation; adding a second, partial recalculation path here
 * would give us two ways to compute the same numbers, and they would drift.
 */
router.post('/:id/correct-score', async (req, res) => {
  try {
    const admin = await requireAdmin(req);

    const rows = await EXECUTESQL('SELECT m.* FROM matches m WHERE m.id = ? LIMIT 1', [req.params.id]);
    const match = rows[0];
    if (!match) return res.status(404).json({ error: 'Match not found' });

    const reason = String(req.body?.reason || '').trim();
    if (!reason) {
      return res.status(400).json({ error: 'A reason is required so the correction can be explained later' });
    }

    const homeScore = parseScore(req.body?.home_score, 'home_score');
    const awayScore = parseScore(req.body?.away_score, 'away_score');

    await EXECUTESQL(
      `UPDATE matches
          SET home_score = ?, away_score = ?,
              score_corrected_at = NOW(), score_corrected_by = ?,
              updated_date = NOW()
        WHERE id = ?`,
      [homeScore, awayScore, admin.id, req.params.id]
    );

    await EXECUTESQL(
      `INSERT INTO admin_audit_log
         (id, admin_user_id, admin_email, action, entity_type, entity_id, entity_name,
          old_value, new_value, reason, created_date)
       VALUES (UUID(), ?, ?, 'correct_match_score', 'match', ?, ?, ?, ?, ?, NOW())`,
      [
        admin.id,
        admin.email || null,
        match.id,
        `${match.home_club_name || match.home_player_name || 'Home'} vs ${match.away_club_name || match.away_player_name || 'Away'}`,
        JSON.stringify({ home_score: match.home_score, away_score: match.away_score }),
        JSON.stringify({ home_score: homeScore, away_score: awayScore }),
        reason,
      ]
    );

    return res.json({
      success: true,
      match_id: match.id,
      home_score: homeScore,
      away_score: awayScore,
      // Said out loud so no caller assumes the correction did more than it did.
      wager_untouched: true,
      rankings_note: 'Rankings and stats update on the next full recalculation.',
    });
  } catch (err) {
    if (!err.status) console.error(err);
    return res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
