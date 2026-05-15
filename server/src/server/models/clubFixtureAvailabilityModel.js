const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class ClubFixtureAvailability {
  constructor(body = {}) {
    this.id = body.id;
    this.club_id = body.club_id;
    this.fixture_id = body.fixture_id;
    this.fixture_type = body.fixture_type;
    this.player_id = body.player_id;
    this.user_id = body.user_id;
    this.status = body.status || 'no_response';
    this.note = body.note;
  }

  selectAll({ club_id, fixture_id, player_id, status, limit = 200, offset = 0 } = {}) {
    const where = [];
    const params = [];
    if (club_id) { where.push('cfa.club_id = ?'); params.push(club_id); }
    if (fixture_id) { where.push('cfa.fixture_id = ?'); params.push(fixture_id); }
    if (player_id) { where.push('cfa.player_id = ?'); params.push(player_id); }
    if (status) { where.push('cfa.status = ?'); params.push(status); }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    params.push(Math.min(Number(limit) || 200, 500), Number(offset) || 0);
    return EXECUTESQL(
      `SELECT cfa.*, p.gamertag AS player_gamertag, p.position AS player_position
       FROM club_fixture_availability cfa
       LEFT JOIN players p ON p.id = cfa.player_id
       ${clause}
       ORDER BY cfa.updated_date DESC
       LIMIT ? OFFSET ?`,
      params
    );
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM club_fixture_availability WHERE id = ?', [id]);
  }

  create() {
    this.id = this.id || uuidv4();
    return EXECUTESQL(
      `INSERT INTO club_fixture_availability
        (id, club_id, fixture_id, fixture_type, player_id, user_id, status, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [this.id, this.club_id, this.fixture_id, this.fixture_type, this.player_id, this.user_id, this.status, this.note]
    );
  }

  update(id) {
    return EXECUTESQL(
      `UPDATE club_fixture_availability SET
        club_id=?, fixture_id=?, fixture_type=?, player_id=?, user_id=?, status=?, note=?, updated_date=NOW()
       WHERE id=?`,
      [this.club_id, this.fixture_id, this.fixture_type, this.player_id, this.user_id, this.status, this.note, id]
    );
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM club_fixture_availability WHERE id = ?', [id]);
  }
}

module.exports = ClubFixtureAvailability;
