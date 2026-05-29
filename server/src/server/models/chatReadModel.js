const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

// Per-user last-read marker for a chat channel.
// channel_id matches `chat_messages.match_id` (which can be a raw match UUID
// or a namespaced channel like `club:<uuid>`).
class ChatRead {
  constructor(body = {}) {
    this.id            = body.id;
    this.user_email    = body.user_email;
    this.channel_id    = body.channel_id;
    this.last_read_at  = body.last_read_at;
  }

  selectAll(page = 1) {
    const pageSize = 200;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL('SELECT * FROM chat_reads ORDER BY updated_date DESC LIMIT ? OFFSET ?', [pageSize, offset]);
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM chat_reads WHERE id = ? LIMIT 1', [id]);
  }

  selectByUser(user_email) {
    return EXECUTESQL(
      'SELECT * FROM chat_reads WHERE LOWER(user_email) = LOWER(?) ORDER BY updated_date DESC',
      [String(user_email || '')]
    );
  }

  selectByUserAndChannel(user_email, channel_id) {
    return EXECUTESQL(
      'SELECT * FROM chat_reads WHERE LOWER(user_email) = LOWER(?) AND channel_id = ? LIMIT 1',
      [String(user_email || ''), String(channel_id || '')]
    );
  }

  // Insert or update (UNIQUE on (user_email, channel_id)).
  upsert({ user_email, channel_id, last_read_at }) {
    const id     = uuidv4();
    const readAt = last_read_at || new Date();
    return EXECUTESQL(
      `INSERT INTO chat_reads (id, user_email, channel_id, last_read_at)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE last_read_at = VALUES(last_read_at), updated_date = NOW()`,
      [id, String(user_email || ''), String(channel_id || ''), readAt]
    );
  }

  // Convenience: compute unread count for one channel using `chat_messages.created_date > last_read_at`.
  // Excludes the user's own messages.
  static async unreadCountsForUser(user_email) {
    const email = String(user_email || '').toLowerCase();
    if (!email) return {};
    // LEFT JOIN so channels with no `chat_reads` row count as fully unread (since the user has never opened them yet, treat last_read_at as epoch).
    const rows = await EXECUTESQL(
      `SELECT cm.match_id AS channel_id, COUNT(*) AS unread_count
         FROM chat_messages cm
         LEFT JOIN chat_reads cr
           ON cr.channel_id = cm.match_id
          AND LOWER(cr.user_email) = ?
        WHERE LOWER(cm.sender_email) <> ?
          AND cm.created_date > COALESCE(cr.last_read_at, '1970-01-01 00:00:00')
        GROUP BY cm.match_id`,
      [email, email]
    );
    const out = {};
    for (const r of rows) out[r.channel_id] = Number(r.unread_count) || 0;
    return out;
  }

  static unreadCountForChannel(user_email, channel_id) {
    const email   = String(user_email || '').toLowerCase();
    const channel = String(channel_id || '');
    if (!email || !channel) return Promise.resolve(0);
    return EXECUTESQL(
      `SELECT COUNT(*) AS unread_count
         FROM chat_messages cm
         LEFT JOIN chat_reads cr
           ON cr.channel_id = cm.match_id
          AND LOWER(cr.user_email) = ?
        WHERE cm.match_id = ?
          AND LOWER(cm.sender_email) <> ?
          AND cm.created_date > COALESCE(cr.last_read_at, '1970-01-01 00:00:00')`,
      [email, channel, email]
    ).then(rows => Number(rows?.[0]?.unread_count || 0));
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM chat_reads WHERE id = ?', [id]);
  }
}

module.exports = ChatRead;
