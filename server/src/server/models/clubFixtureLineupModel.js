const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

function jsonOrNull(value) {
  if (value == null || value === '') return null;
  return typeof value === 'string' ? value : JSON.stringify(value);
}

class ClubFixtureLineup {
  constructor(body = {}) {
    this.id = body.id;
    this.club_id = body.club_id;
    this.fixture_id = body.fixture_id;
    this.fixture_type = body.fixture_type;
    this.formation = body.formation;
    this.starting_players = jsonOrNull(body.starting_players || []);
    this.bench_players = jsonOrNull(body.bench_players || []);
    this.captain_player_id = body.captain_player_id;
    this.notes = body.notes;
    this.status = body.status || 'draft';
    this.created_by_user_id = body.created_by_user_id;
  }

  selectAll({ club_id, fixture_id, status, limit = 100, offset = 0 } = {}) {
    const where = [];
    const params = [];
    if (club_id) { where.push('club_id = ?'); params.push(club_id); }
    if (fixture_id) { where.push('fixture_id = ?'); params.push(fixture_id); }
    if (status) { where.push('status = ?'); params.push(status); }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    params.push(Math.min(Number(limit) || 100, 300), Number(offset) || 0);
    return EXECUTESQL(
      `SELECT * FROM club_fixture_lineups
       ${clause}
       ORDER BY updated_date DESC
       LIMIT ? OFFSET ?`,
      params
    );
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM club_fixture_lineups WHERE id = ?', [id]);
  }

  create() {
    this.id = this.id || uuidv4();
    return EXECUTESQL(
      `INSERT INTO club_fixture_lineups
        (id, club_id, fixture_id, fixture_type, formation, starting_players,
         bench_players, captain_player_id, notes, status, created_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        this.id, this.club_id, this.fixture_id, this.fixture_type, this.formation,
        this.starting_players, this.bench_players, this.captain_player_id,
        this.notes, this.status, this.created_by_user_id,
      ]
    );
  }

  update(id) {
    return EXECUTESQL(
      `UPDATE club_fixture_lineups SET
        club_id=?, fixture_id=?, fixture_type=?, formation=?, starting_players=?,
        bench_players=?, captain_player_id=?, notes=?, status=?, created_by_user_id=?, updated_date=NOW()
       WHERE id=?`,
      [
        this.club_id, this.fixture_id, this.fixture_type, this.formation,
        this.starting_players, this.bench_players, this.captain_player_id,
        this.notes, this.status, this.created_by_user_id, id,
      ]
    );
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM club_fixture_lineups WHERE id = ?', [id]);
  }
}

module.exports = ClubFixtureLineup;
