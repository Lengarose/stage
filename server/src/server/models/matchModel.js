const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');
const { toMysqlDateTime } = require('../utils/datetime');

function normalizeTournamentId(value) {
  if (value === undefined || value === null || value === '') return null;
  if (String(value).toLowerCase() === 'ranked') return null;
  return value;
}

class Match {
  constructor(body = {}) {
    this.id                    = body.id;
    this.tournament_id         = normalizeTournamentId(body.tournament_id);
    this.home_club_id          = body.home_club_id;
    this.away_club_id          = body.away_club_id;
    this.home_club_name        = body.home_club_name;
    this.away_club_name        = body.away_club_name;
    this.home_owner_email      = body.home_owner_email;
    this.away_owner_email      = body.away_owner_email;
    this.home_player_id        = body.home_player_id;
    this.home_player_name      = body.home_player_name;
    this.home_player_email     = body.home_player_email;
    this.away_player_id        = body.away_player_id;
    this.away_player_name      = body.away_player_name;
    this.away_player_email     = body.away_player_email;
    this.home_score            = body.home_score;
    this.away_score            = body.away_score;
    this.status                = body.status;
    this.mode                  = body.mode;
    this.type                  = body.type;
    this.stats_processed       = body.stats_processed;
    this.winner_club_id        = body.winner_club_id;
    this.winner_club_name      = body.winner_club_name;
    this.winner_player_id      = body.winner_player_id;
    this.winner_player_name    = body.winner_player_name;
    this.loser_club_id         = body.loser_club_id;
    this.loser_club_name       = body.loser_club_name;
    this.loser_player_id       = body.loser_player_id;
    this.loser_player_name     = body.loser_player_name;
    this.round                 = body.round;
    this.group_number          = body.group_number ?? body.group;
    this.bracket_side          = body.bracket_side;
    this.scheduled_date        = toMysqlDateTime(body.scheduled_date);
    this.scheduling_status     = body.scheduling_status;
    this.home_proposed_date    = toMysqlDateTime(body.home_proposed_date);
    this.away_proposed_date    = toMysqlDateTime(body.away_proposed_date);
    this.last_proposed_by      = body.last_proposed_by;
    this.proposal_count        = body.proposal_count;
    this.confirmed_date        = toMysqlDateTime(body.confirmed_date);
    this.result_home_submitted = body.result_home_submitted;
    this.result_away_submitted = body.result_away_submitted;
    this.home_submission       = body.home_submission
      ? (typeof body.home_submission === 'string' ? body.home_submission : JSON.stringify(body.home_submission))
      : null;
    this.away_submission       = body.away_submission
      ? (typeof body.away_submission === 'string' ? body.away_submission : JSON.stringify(body.away_submission))
      : null;
    this.home_submitted_score  = body.home_submitted_score;
    this.away_submitted_score  = body.away_submitted_score;
    this.first_submission_at   = toMysqlDateTime(body.first_submission_at);
    this.first_submitter_club_id = body.first_submitter_club_id;
    this.video_url             = body.video_url;
    this.proof_url             = body.proof_url;
    this.stream_url            = body.stream_url;
    this.home_stream_url       = body.home_stream_url;
    this.away_stream_url       = body.away_stream_url;
    this.stream_embed_html     = body.stream_embed_html;
    this.forfeit_claimed_by    = body.forfeit_claimed_by;
    this.forfeit_proof_url     = body.forfeit_proof_url;
    this.forfeit_status        = body.forfeit_status;
    this.admin_notes           = body.admin_notes;
    this.notes                 = body.notes;
    this.wager_stc             = body.wager_stc;
    this.wager_status          = body.wager_status;
    this.wager_home_locked     = body.wager_home_locked;
    this.wager_away_locked     = body.wager_away_locked;
    this.wager_home_player_id  = body.wager_home_player_id;
    this.wager_away_player_id  = body.wager_away_player_id;
    this.source_fixture_id     = body.source_fixture_id;
    this.source_fixture_type   = body.source_fixture_type;
    this.competition_context   = body.competition_context;
    this.home_goal_events      = body.home_goal_events
      ? (typeof body.home_goal_events === 'string' ? body.home_goal_events : JSON.stringify(body.home_goal_events))
      : null;
    this.away_goal_events      = body.away_goal_events
      ? (typeof body.away_goal_events === 'string' ? body.away_goal_events : JSON.stringify(body.away_goal_events))
      : null;
  }

  selectAll(page = 1) {
    const pageSize = 25;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL('SELECT * FROM matches LIMIT ? OFFSET ?', [pageSize, offset]);
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM matches WHERE id = ?', [id]);
  }

  selectByClub(club_id) {
    return EXECUTESQL(
      'SELECT * FROM matches WHERE home_club_id = ? OR away_club_id = ? ORDER BY scheduled_date DESC',
      [club_id, club_id]
    );
  }

  selectByTournament(tournament_id) {
    return EXECUTESQL('SELECT * FROM matches WHERE tournament_id = ?', [tournament_id]);
  }

  selectByStatus(status) {
    return EXECUTESQL('SELECT * FROM matches WHERE status = ?', [status]);
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO matches
      (id, tournament_id,
       home_club_id, away_club_id, home_club_name, away_club_name,
       home_owner_email, away_owner_email,
       home_player_id, home_player_name, home_player_email,
       away_player_id, away_player_name, away_player_email,
       home_score, away_score, status, mode, type, stats_processed,
       winner_club_id, winner_club_name, winner_player_id, winner_player_name,
       loser_club_id, loser_club_name, loser_player_id, loser_player_name,
       round, group_number, bracket_side, scheduled_date,
       scheduling_status, home_proposed_date, away_proposed_date, last_proposed_by, proposal_count, confirmed_date,
       result_home_submitted, result_away_submitted,
       home_submission, away_submission,
       home_submitted_score, away_submitted_score,
       first_submission_at, first_submitter_club_id,
       video_url, proof_url,
       stream_url, home_stream_url, away_stream_url, stream_embed_html,
       forfeit_claimed_by, forfeit_proof_url, forfeit_status,
       admin_notes, notes,
       wager_stc, wager_status, wager_home_locked, wager_away_locked,
       wager_home_player_id, wager_away_player_id,
       source_fixture_id, source_fixture_type, competition_context,
       home_goal_events, away_goal_events)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    const values = [
      this.id, this.tournament_id,
      this.home_club_id, this.away_club_id, this.home_club_name, this.away_club_name,
      this.home_owner_email, this.away_owner_email,
      this.home_player_id, this.home_player_name, this.home_player_email,
      this.away_player_id, this.away_player_name, this.away_player_email,
      this.home_score, this.away_score, this.status, this.mode, this.type, this.stats_processed,
      this.winner_club_id, this.winner_club_name, this.winner_player_id, this.winner_player_name,
      this.loser_club_id, this.loser_club_name, this.loser_player_id, this.loser_player_name,
      this.round, this.group_number, this.bracket_side, this.scheduled_date,
      this.scheduling_status, this.home_proposed_date, this.away_proposed_date, this.last_proposed_by, this.proposal_count, this.confirmed_date,
      this.result_home_submitted, this.result_away_submitted,
      this.home_submission, this.away_submission,
      this.home_submitted_score, this.away_submitted_score,
      this.first_submission_at, this.first_submitter_club_id,
      this.video_url, this.proof_url,
      this.stream_url, this.home_stream_url, this.away_stream_url, this.stream_embed_html,
      this.forfeit_claimed_by, this.forfeit_proof_url, this.forfeit_status,
      this.admin_notes, this.notes,
      this.wager_stc, this.wager_status, this.wager_home_locked, this.wager_away_locked,
      this.wager_home_player_id, this.wager_away_player_id,
      this.source_fixture_id, this.source_fixture_type, this.competition_context,
      this.home_goal_events, this.away_goal_events,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE matches SET
      tournament_id=?,
      home_club_id=?, away_club_id=?, home_club_name=?, away_club_name=?,
      home_owner_email=?, away_owner_email=?,
      home_player_id=?, home_player_name=?, home_player_email=?,
      away_player_id=?, away_player_name=?, away_player_email=?,
      home_score=?, away_score=?, status=?, mode=?, type=?, stats_processed=?,
      winner_club_id=?, winner_club_name=?, winner_player_id=?, winner_player_name=?,
      loser_club_id=?, loser_club_name=?, loser_player_id=?, loser_player_name=?,
      round=?, group_number=?, bracket_side=?, scheduled_date=?,
      scheduling_status=?, home_proposed_date=?, away_proposed_date=?, last_proposed_by=?, proposal_count=?, confirmed_date=?,
      result_home_submitted=?, result_away_submitted=?,
      home_submission=?, away_submission=?,
      home_submitted_score=?, away_submitted_score=?,
      first_submission_at=?, first_submitter_club_id=?,
      video_url=?, proof_url=?,
      stream_url=?, home_stream_url=?, away_stream_url=?, stream_embed_html=?,
      forfeit_claimed_by=?, forfeit_proof_url=?, forfeit_status=?,
      admin_notes=?, notes=?,
      wager_stc=?, wager_status=?, wager_home_locked=?, wager_away_locked=?,
      wager_home_player_id=?, wager_away_player_id=?,
      source_fixture_id=?, source_fixture_type=?, competition_context=?,
      home_goal_events=?, away_goal_events=?
      WHERE id=?`;
    const values = [
      this.tournament_id,
      this.home_club_id, this.away_club_id, this.home_club_name, this.away_club_name,
      this.home_owner_email, this.away_owner_email,
      this.home_player_id, this.home_player_name, this.home_player_email,
      this.away_player_id, this.away_player_name, this.away_player_email,
      this.home_score, this.away_score, this.status, this.mode, this.type, this.stats_processed,
      this.winner_club_id, this.winner_club_name, this.winner_player_id, this.winner_player_name,
      this.loser_club_id, this.loser_club_name, this.loser_player_id, this.loser_player_name,
      this.round, this.group_number, this.bracket_side, this.scheduled_date,
      this.scheduling_status, this.home_proposed_date, this.away_proposed_date, this.last_proposed_by, this.proposal_count, this.confirmed_date,
      this.result_home_submitted, this.result_away_submitted,
      this.home_submission, this.away_submission,
      this.home_submitted_score, this.away_submitted_score,
      this.first_submission_at, this.first_submitter_club_id,
      this.video_url, this.proof_url,
      this.stream_url, this.home_stream_url, this.away_stream_url, this.stream_embed_html,
      this.forfeit_claimed_by, this.forfeit_proof_url, this.forfeit_status,
      this.admin_notes, this.notes,
      this.wager_stc, this.wager_status, this.wager_home_locked, this.wager_away_locked,
      this.wager_home_player_id, this.wager_away_player_id,
      this.source_fixture_id, this.source_fixture_type, this.competition_context,
      this.home_goal_events, this.away_goal_events,
      id,
    ];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM matches WHERE id = ?', [id]);
  }
}

module.exports = Match;
