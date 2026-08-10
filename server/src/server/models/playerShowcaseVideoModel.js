const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

/**
 * A clip a player published on their own profile so clubs can see how they play.
 *
 * The player owns these rows. Scouts read them; they never write them — that was
 * the point of moving video ownership off the scouting report and onto the player.
 */
class PlayerShowcaseVideo {
  constructor(body = {}) {
    this.id = body.id;
    this.player_id = body.player_id;
    this.url = typeof body.url === 'string' ? body.url.trim() : body.url;
    this.title = typeof body.title === 'string'
      ? (body.title.trim() || null)
      : (body.title ?? null);
    this.description = typeof body.description === 'string'
      ? (body.description.trim() || null)
      : (body.description ?? null);
    const duration = Number(body.duration_seconds);
    this.duration_seconds = Number.isFinite(duration) && duration >= 0
      ? Math.round(duration * 100) / 100
      : null;
    this.sort_order = Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0;
  }

  selectByPlayer(playerId) {
    return EXECUTESQL(
      `SELECT * FROM player_showcase_videos
        WHERE player_id = ?
        ORDER BY sort_order ASC, created_date ASC`,
      [playerId]
    );
  }

  /**
   * Clips for several players at once. The scouting board needs the showcase of
   * every player on it; fetching them one card at a time is a request per row.
   */
  static selectByPlayers(playerIds = []) {
    if (!playerIds.length) return Promise.resolve([]);
    const placeholders = playerIds.map(() => '?').join(',');
    return EXECUTESQL(
      `SELECT * FROM player_showcase_videos
        WHERE player_id IN (${placeholders})
        ORDER BY player_id ASC, sort_order ASC, created_date ASC`,
      playerIds
    );
  }

  selectOne(id) {
    return EXECUTESQL(
      `SELECT
          v.*,
          p.email AS owner_email,
          p.gamertag,
          p.avatar_url,
          p.position,
          p.showcase_position,
          p.country,
          p.country_code
        FROM player_showcase_videos v
        LEFT JOIN players p ON p.id = v.player_id
        WHERE v.id = ?`,
      [id]
    );
  }

  static selectScoutingVideos({
    filter = 'recent',
    position = '',
    country = '',
    currentUserEmail = '',
  } = {}) {
    const where = [];
    const params = [];
    const requestedPosition = String(position || '').trim();
    const requestedCountry = String(country || '').trim();
    const email = String(currentUserEmail || '').trim().toLowerCase();

    if (requestedPosition) {
      where.push('UPPER(COALESCE(NULLIF(p.showcase_position, \'\'), p.position, \'\')) = UPPER(?)');
      params.push(requestedPosition);
    }
    if (requestedCountry) {
      where.push('(UPPER(COALESCE(p.country_code, \'\')) = UPPER(?) OR UPPER(COALESCE(p.country, \'\')) = UPPER(?))');
      params.push(requestedCountry, requestedCountry);
    }

    const orderBy = filter === 'trending'
      ? 'COALESCE(v.likes_count, 0) + COALESCE(v.comments_count, 0) DESC, v.created_date DESC'
      : 'v.created_date DESC';

    return EXECUTESQL(
      `SELECT
          v.id,
          v.title,
          v.url,
          v.url AS media_url,
          v.duration_seconds,
          COALESCE(v.likes_count, 0) AS likes_count,
          COALESCE(v.comments_count, 0) AS comments_count,
          v.player_id,
          p.gamertag,
          p.avatar_url,
          p.position,
          p.showcase_position,
          p.country,
          p.country_code,
          EXISTS(
            SELECT 1 FROM player_showcase_video_likes l
             WHERE l.video_id = v.id AND LOWER(l.user_email) = LOWER(?)
          ) AS liked_by_me
        FROM player_showcase_videos v
        INNER JOIN players p ON p.id = v.player_id
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY ${orderBy}
        LIMIT 100`,
      [email, ...params]
    );
  }

  static async toggleScoutingLike(videoId, userEmail) {
    const email = String(userEmail || '').trim().toLowerCase();
    const existing = await EXECUTESQL(
      'SELECT id FROM player_showcase_video_likes WHERE video_id = ? AND LOWER(user_email) = LOWER(?) LIMIT 1',
      [videoId, email]
    );
    const liked = existing.length === 0;
    if (liked) {
      await EXECUTESQL(
        'INSERT IGNORE INTO player_showcase_video_likes (id, video_id, user_email) VALUES (?,?,?)',
        [uuidv4(), videoId, email]
      );
    } else {
      await EXECUTESQL(
        'DELETE FROM player_showcase_video_likes WHERE video_id = ? AND LOWER(user_email) = LOWER(?)',
        [videoId, email]
      );
    }
    await EXECUTESQL(
      `UPDATE player_showcase_videos
          SET likes_count = (SELECT COUNT(*) FROM player_showcase_video_likes WHERE video_id = ?)
        WHERE id = ?`,
      [videoId, videoId]
    );
    const rows = await EXECUTESQL(
      `SELECT
          v.*,
          v.url AS media_url,
          p.email AS owner_email,
          p.gamertag,
          p.avatar_url,
          p.position,
          p.showcase_position,
          p.country,
          p.country_code,
          EXISTS(
            SELECT 1 FROM player_showcase_video_likes l
             WHERE l.video_id = v.id AND LOWER(l.user_email) = LOWER(?)
          ) AS liked_by_me
        FROM player_showcase_videos v
        LEFT JOIN players p ON p.id = v.player_id
        WHERE v.id = ?`,
      [email, videoId]
    );
    return { liked, video: rows[0] || null };
  }

  static selectScoutingComments(videoId) {
    return EXECUTESQL(
      `SELECT *
        FROM player_showcase_video_comments
        WHERE video_id = ?
        ORDER BY created_date ASC`,
      [videoId]
    );
  }

  static async createScoutingComment(body = {}) {
    const id = uuidv4();
    await EXECUTESQL(
      `INSERT INTO player_showcase_video_comments
        (id, video_id, author_email, author_player_id, author_name, author_avatar_url, content, created_date)
       VALUES (?,?,?,?,?,?,?, NOW())`,
      [
        id,
        body.video_id,
        body.author_email,
        body.author_player_id || null,
        body.author_name,
        body.author_avatar_url || '',
        body.content,
      ]
    );
    await EXECUTESQL(
      `UPDATE player_showcase_videos
          SET comments_count = (SELECT COUNT(*) FROM player_showcase_video_comments WHERE video_id = ?)
        WHERE id = ?`,
      [body.video_id, body.video_id]
    );
    const rows = await EXECUTESQL(
      'SELECT * FROM player_showcase_video_comments WHERE id = ? LIMIT 1',
      [id]
    );
    return rows[0] || null;
  }

  create() {
    this.id = this.id || uuidv4();
    return EXECUTESQL(
      `INSERT INTO player_showcase_videos (id, player_id, url, title, description, duration_seconds, sort_order)
       VALUES (?,?,?,?,?,?,?)`,
      [this.id, this.player_id, this.url, this.title, this.description, this.duration_seconds, this.sort_order]
    );
  }

  update(id) {
    // player_id is deliberately not updatable: a clip belongs to whoever published
    // it, and letting a patch move it would hand one player's footage to another.
    return EXECUTESQL(
      `UPDATE player_showcase_videos
          SET url = ?, title = ?, description = ?, duration_seconds = ?, sort_order = ?, updated_date = NOW()
        WHERE id = ?`,
      [this.url, this.title, this.description, this.duration_seconds, this.sort_order, id]
    );
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM player_showcase_videos WHERE id = ?', [id]);
  }
}

module.exports = PlayerShowcaseVideo;
