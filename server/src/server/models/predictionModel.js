const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class PredictionModel {
  static async getAll({ limit = 25, offset = 0, player_id, match_id, live_match_id, predictor_email } = {}) {
    let sql = 'SELECT * FROM predictions WHERE 1=1';
    const params = [];
    if (player_id)       { sql += ' AND player_id = ?';       params.push(player_id); }
    if (match_id)        { sql += ' AND match_id = ?';        params.push(match_id); }
    if (live_match_id)   { sql += ' AND live_match_id = ?';   params.push(live_match_id); }
    if (predictor_email) { sql += ' AND predictor_email = ?'; params.push(predictor_email); }
    sql += ' ORDER BY created_date DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));
    return EXECUTESQL(sql, params);
  }

  static async getById(id) {
    const rows = await EXECUTESQL('SELECT * FROM predictions WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async create(data) {
    const id = uuidv4();
    await EXECUTESQL(
      `INSERT INTO predictions
        (id, match_id, live_match_id, player_id, predictor_email, predictor_name,
         home_score, away_score, predicted_home_score, predicted_away_score,
         predicted_scorer_email, predicted_assist_email, predicted_motm_email,
         status, match_status, points_earned,
         score_correct, scorer_correct, assist_correct, motm_correct,
         score_points, scorer_points, assist_motm_points, total_points,
         created_date)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW())`,
      [
        id,
        data.match_id || null,
        data.live_match_id || null,
        data.player_id || null,
        data.predictor_email || null,
        data.predictor_name || null,
        data.home_score ?? null,
        data.away_score ?? null,
        data.predicted_home_score ?? null,
        data.predicted_away_score ?? null,
        data.predicted_scorer_email || null,
        data.predicted_assist_email || null,
        data.predicted_motm_email || null,
        data.status || 'pending',
        data.match_status || 'pending',
        data.points_earned || 0,
        data.score_correct ? 1 : 0,
        data.scorer_correct ? 1 : 0,
        data.assist_correct ? 1 : 0,
        data.motm_correct ? 1 : 0,
        data.score_points || 0,
        data.scorer_points || 0,
        data.assist_motm_points || 0,
        data.total_points || 0,
      ]
    );
    return this.getById(id);
  }

  static async update(id, data) {
    const fields = [];
    const params = [];
    const updatable = [
      'home_score', 'away_score', 'predicted_home_score', 'predicted_away_score',
      'predicted_scorer_email', 'predicted_assist_email', 'predicted_motm_email',
      'status', 'match_status', 'points_earned',
      'score_correct', 'scorer_correct', 'assist_correct', 'motm_correct',
      'score_points', 'scorer_points', 'assist_motm_points', 'total_points',
      'predictor_name',
    ];
    for (const key of updatable) {
      if (data[key] !== undefined) {
        fields.push(`${key} = ?`);
        params.push(data[key]);
      }
    }
    if (!fields.length) return this.getById(id);
    params.push(id);
    await EXECUTESQL(`UPDATE predictions SET ${fields.join(', ')} WHERE id = ?`, params);
    return this.getById(id);
  }

  static async delete(id) {
    return EXECUTESQL('DELETE FROM predictions WHERE id = ?', [id]);
  }
}

module.exports = PredictionModel;
