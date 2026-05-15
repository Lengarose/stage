const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class RecruitmentInterest {
  constructor(body = {}) {
    this.id = body.id;
    this.recruitment_post_id = body.recruitment_post_id;
    this.sender_user_id = body.sender_user_id;
    this.sender_player_id = body.sender_player_id;
    this.sender_club_id = body.sender_club_id;
    this.recipient_user_id = body.recipient_user_id;
    this.recipient_player_id = body.recipient_player_id;
    this.recipient_club_id = body.recipient_club_id;
    this.message = body.message;
    this.status = body.status || 'pending';
  }

  selectAll({ recruitment_post_id, sender_user_id, sender_player_id, sender_club_id, recipient_user_id, recipient_player_id, recipient_club_id, viewer_user_id, status, limit = 100, offset = 0 } = {}) {
    const where = [];
    const params = [];
    if (recruitment_post_id) { where.push('ri.recruitment_post_id = ?'); params.push(recruitment_post_id); }
    if (sender_user_id) { where.push('ri.sender_user_id = ?'); params.push(sender_user_id); }
    if (sender_player_id) { where.push('ri.sender_player_id = ?'); params.push(sender_player_id); }
    if (sender_club_id) { where.push('ri.sender_club_id = ?'); params.push(sender_club_id); }
    if (recipient_user_id) { where.push('ri.recipient_user_id = ?'); params.push(recipient_user_id); }
    if (recipient_player_id) { where.push('ri.recipient_player_id = ?'); params.push(recipient_player_id); }
    if (recipient_club_id) { where.push('ri.recipient_club_id = ?'); params.push(recipient_club_id); }
    if (viewer_user_id) {
      where.push('(ri.sender_user_id = ? OR ri.recipient_user_id = ?)');
      params.push(viewer_user_id, viewer_user_id);
    }
    if (status) { where.push('ri.status = ?'); params.push(status); }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    params.push(Math.min(Number(limit) || 100, 200), Number(offset) || 0);
    return EXECUTESQL(
      `SELECT ri.*, rp.title AS recruitment_post_title, rp.post_type,
              sp.gamertag AS sender_player_gamertag, sc.name AS sender_club_name,
              rp2.gamertag AS recipient_player_gamertag, rc.name AS recipient_club_name
       FROM recruitment_interests ri
       LEFT JOIN recruitment_posts rp ON rp.id = ri.recruitment_post_id
       LEFT JOIN players sp ON sp.id = ri.sender_player_id
       LEFT JOIN clubs sc ON sc.id = ri.sender_club_id
       LEFT JOIN players rp2 ON rp2.id = ri.recipient_player_id
       LEFT JOIN clubs rc ON rc.id = ri.recipient_club_id
       ${clause}
       ORDER BY ri.created_date DESC
       LIMIT ? OFFSET ?`,
      params
    );
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM recruitment_interests WHERE id = ?', [id]);
  }

  create() {
    this.id = this.id || uuidv4();
    return EXECUTESQL(
      `INSERT INTO recruitment_interests
        (id, recruitment_post_id, sender_user_id, sender_player_id, sender_club_id,
         recipient_user_id, recipient_player_id, recipient_club_id, message, status)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        this.id, this.recruitment_post_id, this.sender_user_id, this.sender_player_id,
        this.sender_club_id, this.recipient_user_id, this.recipient_player_id,
        this.recipient_club_id, this.message, this.status,
      ]
    );
  }

  update(id) {
    return EXECUTESQL(
      `UPDATE recruitment_interests SET
        recruitment_post_id=?, sender_user_id=?, sender_player_id=?, sender_club_id=?,
        recipient_user_id=?, recipient_player_id=?, recipient_club_id=?, message=?,
        status=?, updated_date=NOW()
       WHERE id=?`,
      [
        this.recruitment_post_id, this.sender_user_id, this.sender_player_id,
        this.sender_club_id, this.recipient_user_id, this.recipient_player_id,
        this.recipient_club_id, this.message, this.status, id,
      ]
    );
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM recruitment_interests WHERE id = ?', [id]);
  }
}

module.exports = RecruitmentInterest;
