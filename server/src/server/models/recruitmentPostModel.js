const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

function jsonOrNull(value) {
  if (value == null || value === '') return null;
  return typeof value === 'string' ? value : JSON.stringify(value);
}

class RecruitmentPost {
  constructor(body = {}) {
    this.id = body.id;
    this.author_user_id = body.author_user_id;
    this.author_player_id = body.author_player_id;
    this.author_club_id = body.author_club_id;
    this.post_type = body.post_type;
    this.title = body.title;
    this.body = body.body;
    this.positions_needed = jsonOrNull(body.positions_needed);
    this.preferred_positions = jsonOrNull(body.preferred_positions);
    this.platform = body.platform;
    this.region = body.region;
    this.availability_text = body.availability_text;
    this.discord_handle = body.discord_handle;
    this.mic_required = body.mic_required ? 1 : 0;
    this.verified_only = body.verified_only ? 1 : 0;
    this.status = body.status || 'open';
    this.expires_at = body.expires_at || null;
  }

  selectAll({ post_type, author_player_id, author_club_id, platform, region, status, position, verified_only, limit = 100, offset = 0 } = {}) {
    const where = [];
    const params = [];
    if (post_type) { where.push('rp.post_type = ?'); params.push(post_type); }
    if (author_player_id) { where.push('rp.author_player_id = ?'); params.push(author_player_id); }
    if (author_club_id) { where.push('rp.author_club_id = ?'); params.push(author_club_id); }
    if (platform) { where.push('rp.platform = ?'); params.push(platform); }
    if (region) { where.push('rp.region = ?'); params.push(region); }
    if (status) { where.push('rp.status = ?'); params.push(status); }
    if (verified_only !== undefined && verified_only !== null && verified_only !== '') {
      where.push('rp.verified_only = ?');
      params.push(Number(verified_only) ? 1 : 0);
    }
    if (position) {
      where.push('(JSON_CONTAINS(rp.positions_needed, JSON_QUOTE(?)) OR JSON_CONTAINS(rp.preferred_positions, JSON_QUOTE(?)))');
      params.push(position, position);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    params.push(Math.min(Number(limit) || 100, 200), Number(offset) || 0);
    return EXECUTESQL(
      `SELECT rp.*,
              p.gamertag AS author_player_gamertag,
              p.avatar_url AS author_player_avatar_url,
              p.position AS author_player_position,
              p.secondary_position AS author_player_secondary_position,
              p.is_verified AS author_player_is_verified,
              c.name AS author_club_name,
              c.logo_url AS author_club_logo_url,
              c.tag AS author_club_tag
       FROM recruitment_posts rp
       LEFT JOIN players p ON p.id = rp.author_player_id
       LEFT JOIN clubs c ON c.id = rp.author_club_id
       ${clause}
       ORDER BY rp.created_date DESC
       LIMIT ? OFFSET ?`,
      params
    );
  }

  selectOne(id) {
    return EXECUTESQL(
      `SELECT rp.*,
              p.gamertag AS author_player_gamertag,
              p.avatar_url AS author_player_avatar_url,
              p.position AS author_player_position,
              p.secondary_position AS author_player_secondary_position,
              p.is_verified AS author_player_is_verified,
              c.name AS author_club_name,
              c.logo_url AS author_club_logo_url,
              c.tag AS author_club_tag
       FROM recruitment_posts rp
       LEFT JOIN players p ON p.id = rp.author_player_id
       LEFT JOIN clubs c ON c.id = rp.author_club_id
       WHERE rp.id = ?`,
      [id]
    );
  }

  create() {
    this.id = this.id || uuidv4();
    return EXECUTESQL(
      `INSERT INTO recruitment_posts
        (id, author_user_id, author_player_id, author_club_id, post_type, title, body,
         positions_needed, preferred_positions, platform, region, availability_text,
         discord_handle, mic_required, verified_only, status, expires_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        this.id, this.author_user_id, this.author_player_id, this.author_club_id,
        this.post_type, this.title, this.body, this.positions_needed, this.preferred_positions,
        this.platform, this.region, this.availability_text, this.discord_handle,
        this.mic_required, this.verified_only, this.status, this.expires_at,
      ]
    );
  }

  update(id) {
    return EXECUTESQL(
      `UPDATE recruitment_posts SET
        author_user_id=?, author_player_id=?, author_club_id=?, post_type=?, title=?, body=?,
        positions_needed=?, preferred_positions=?, platform=?, region=?, availability_text=?,
        discord_handle=?, mic_required=?, verified_only=?, status=?, expires_at=?, updated_date=NOW()
       WHERE id=?`,
      [
        this.author_user_id, this.author_player_id, this.author_club_id,
        this.post_type, this.title, this.body, this.positions_needed, this.preferred_positions,
        this.platform, this.region, this.availability_text, this.discord_handle,
        this.mic_required, this.verified_only, this.status, this.expires_at, id,
      ]
    );
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM recruitment_posts WHERE id = ?', [id]);
  }
}

module.exports = RecruitmentPost;
