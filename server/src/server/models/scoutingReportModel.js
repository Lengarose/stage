const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

/**
 * A scouting report is a club-private note that one member ("the scout") files on
 * a player they think the club should sign, backed by video links.
 *
 * Reports are always read through a club: there is deliberately no "select all"
 * across clubs, because no caller in the app is ever allowed to see another
 * club's scouting. Scoping lives in the query itself, not in a filter the caller
 * passes, so a missing filter cannot leak rows.
 */

/**
 * Trims and drops blanks. Single source of truth for what counts as a usable
 * link — the controller validates with this too, so "what gets rejected" and
 * "what gets stored" can never drift apart.
 */
function cleanVideoLinks(value) {
  const links = Array.isArray(value) ? value : (value ? [value] : []);
  return links.map((link) => String(link || '').trim()).filter(Boolean);
}

function serializeVideoLinks(value) {
  return JSON.stringify(cleanVideoLinks(value));
}

/** MySQL may hand back JSON columns as a string or as a parsed value. */
function parseVideoLinks(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Votes are {"<player_id>": "for"|"against"}. Anything that isn't a usable object
 * degrades to {} — an unreadable tally must not break the whole report.
 */
function parseVotes(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeRow(row = {}) {
  return {
    ...row,
    video_links: parseVideoLinks(row.video_links),
    votes: parseVotes(row.votes),
  };
}

const REPORT_SELECT = `
  SELECT sr.*,
         target.gamertag           AS target_gamertag,
         target.avatar_url         AS target_avatar_url,
         target.avatar_position    AS target_avatar_position,
         target.position           AS target_position,
         target.secondary_position AS target_secondary_position,
         target.platform           AS target_platform,
         target.country            AS target_country,
         target.overall_rating     AS target_overall_rating,
         target.club_id            AS target_club_id,
         targetclub.name           AS target_club_name,
         scout.gamertag            AS scout_gamertag,
         scout.avatar_url          AS scout_avatar_url
    FROM scouting_reports sr
    LEFT JOIN players target      ON target.id = sr.target_player_id
    LEFT JOIN clubs   targetclub  ON targetclub.id = target.club_id
    LEFT JOIN players scout       ON scout.id = sr.scouted_by_player_id`;

class ScoutingReport {
  constructor(body = {}) {
    this.id = body.id;
    this.club_id = body.club_id;
    this.scouted_by_player_id = body.scouted_by_player_id || null;
    this.scouted_by_user_id = body.scouted_by_user_id || null;
    this.target_player_id = body.target_player_id;
    this.video_links = serializeVideoLinks(body.video_links);
    this.notes = body.notes || null;
    this.status = body.status || 'open';
  }

  static normalizeRow(row) {
    return normalizeRow(row);
  }

  static cleanVideoLinks(value) {
    return cleanVideoLinks(value);
  }

  /**
   * @param {string} clubId  required — the caller's own club, resolved server-side
   */
  selectByClub(clubId, { status, limit = 100, offset = 0 } = {}) {
    const where = ['sr.club_id = ?'];
    const params = [clubId];
    if (status) { where.push('sr.status = ?'); params.push(status); }
    params.push(Math.min(Number(limit) || 100, 200), Number(offset) || 0);
    return EXECUTESQL(
      `${REPORT_SELECT}
        WHERE ${where.join(' AND ')}
        ORDER BY sr.created_date DESC
        LIMIT ? OFFSET ?`,
      params
    ).then((rows) => rows.map(normalizeRow));
  }

  selectOne(id) {
    return EXECUTESQL(`${REPORT_SELECT} WHERE sr.id = ?`, [id])
      .then((rows) => rows.map(normalizeRow));
  }

  create() {
    this.id = this.id || uuidv4();
    return EXECUTESQL(
      `INSERT INTO scouting_reports
        (id, club_id, scouted_by_player_id, scouted_by_user_id, target_player_id,
         video_links, notes, status)
       VALUES (?,?,?,?,?,?,?,?)`,
      [
        this.id, this.club_id, this.scouted_by_player_id, this.scouted_by_user_id,
        this.target_player_id, this.video_links, this.notes, this.status,
      ]
    );
  }

  update(id) {
    return EXECUTESQL(
      `UPDATE scouting_reports SET
        video_links = ?, notes = ?, status = ?, updated_date = NOW()
       WHERE id = ?`,
      [this.video_links, this.notes, this.status, id]
    );
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM scouting_reports WHERE id = ?', [id]);
  }
}

module.exports = ScoutingReport;
