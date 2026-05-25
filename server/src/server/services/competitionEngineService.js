const { v4: uuidv4 } = require('uuid');
const { EXECUTESQL } = require('../db/database');
const CompetitionEngineModel = require('../models/competitionEngineModel');
const Match = require('../models/matchModel');

const model = new CompetitionEngineModel();

function assertSide(side) {
  if (!['home', 'away'].includes(side)) {
    const err = new Error('side must be home or away');
    err.status = 400;
    throw err;
  }
}

function mapFixtureToMatch(fixture) {
  return {
    id: uuidv4(),
    tournament_id: fixture.competition_instance_id,
    home_club_id: fixture.home_club_id,
    away_club_id: fixture.away_club_id,
    home_club_name: fixture.home_club_name,
    away_club_name: fixture.away_club_name,
    home_owner_email: fixture.home_owner_email,
    away_owner_email: fixture.away_owner_email,
    home_player_id: fixture.player_home_id,
    home_player_name: fixture.player_home_gamertag,
    home_player_email: fixture.player_home_email,
    away_player_id: fixture.player_away_id,
    away_player_name: fixture.player_away_gamertag,
    away_player_email: fixture.player_away_email,
    status: fixture.scheduled_at ? 'scheduled' : 'pending_schedule',
    mode: fixture.participant_type === 'player' ? 'player' : 'club',
    type: fixture.format || 'competition_engine',
    round: fixture.round,
    group_number: fixture.group_number,
    bracket_side: fixture.bracket_side,
    scheduled_date: fixture.scheduled_at,
    source_fixture_id: fixture.id,
    source_fixture_type: 'competition_engine',
    competition_context: fixture.competition_instance_id,
  };
}

async function createMatchFromFixture(fixtureId) {
  const rows = await model.selectFixture(fixtureId);
  if (!rows.length) {
    const err = new Error('Fixture not found');
    err.status = 404;
    throw err;
  }
  const fixture = rows[0];
  if (fixture.match_id) {
    const existing = await EXECUTESQL('SELECT * FROM matches WHERE id = ?', [fixture.match_id]);
    if (existing.length) return existing[0];
  }

  const payload = mapFixtureToMatch(fixture);
  const match = new Match(payload);
  await match.create();
  await EXECUTESQL(
    `UPDATE competition_fixtures
     SET match_id = ?, status = ?, scheduling_status = ?, updated_date = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [payload.id, payload.status === 'scheduled' ? 'scheduled' : fixture.status, fixture.scheduling_status || 'confirmed', fixture.id],
  );
  return payload;
}

function submissionsAgree(home, away) {
  return Number(home.score_home) === Number(away.score_home) &&
    Number(home.score_away) === Number(away.score_away);
}

async function finalizeAgreedResult(fixture, home, away) {
  const homeScore = Number(home.score_home);
  const awayScore = Number(home.score_away);
  const winnerParticipantId = homeScore > awayScore
    ? fixture.home_participant_id
    : awayScore > homeScore
      ? fixture.away_participant_id
      : null;
  await EXECUTESQL(
    `UPDATE matches
     SET status = 'completed', home_score = ?, away_score = ?, stats_processed = 1
     WHERE id = ?`,
    [homeScore, awayScore, fixture.match_id],
  );
  await EXECUTESQL(
    `UPDATE competition_fixtures
     SET status = 'completed', home_score = ?, away_score = ?, winner_participant_id = ?, stats_processed = 1, updated_date = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [homeScore, awayScore, winnerParticipantId, fixture.id],
  );
  return { status: 'completed', home_score: homeScore, away_score: awayScore, winner_participant_id: winnerParticipantId };
}

async function submitResult({ matchId, side, submittedByUserId, scoreHome, scoreAway, payloadJson, proofUrl }) {
  assertSide(side);
  const fixtureRows = await model.selectFixtureByMatch(matchId);
  if (!fixtureRows.length) {
    const err = new Error('Competition fixture not found for match');
    err.status = 404;
    throw err;
  }
  const fixture = fixtureRows[0];
  await model.insertResultSubmission({
    id: uuidv4(),
    fixture_id: fixture.id,
    match_id: matchId,
    side,
    submitted_by_user_id: submittedByUserId,
    score_home: Number(scoreHome),
    score_away: Number(scoreAway),
    payload_json: payloadJson || null,
    proof_url: proofUrl || null,
    idempotency_key: `match_submission:${matchId}:${side}`,
  });
  const submissions = await model.listResultSubmissionsByMatch(matchId);
  const home = submissions.find((entry) => entry.side === 'home');
  const away = submissions.find((entry) => entry.side === 'away');
  if (!home || !away) return { status: 'pending_confirmation' };
  if (!submissionsAgree(home, away)) {
    await EXECUTESQL("UPDATE matches SET status = 'disputed' WHERE id = ?", [matchId]);
    await EXECUTESQL("UPDATE competition_fixtures SET status = 'disputed', updated_date = CURRENT_TIMESTAMP WHERE id = ?", [fixture.id]);
    return { status: 'disputed' };
  }
  return finalizeAgreedResult(fixture, home, away);
}

module.exports = {
  createMatchFromFixture,
  submitResult,
  mapFixtureToMatch,
};
